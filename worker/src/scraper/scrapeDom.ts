import { chromium, Browser } from 'playwright';
import { NormalizedDomNode } from '../shared/types';
import { fail } from '../errors';

export interface ScrapeResult {
  nodes: NormalizedDomNode[];
  screenshotBase64: string;
  pageWidth: number;
  pageHeight: number;
}

let sharedBrowser: Promise<Browser> | null = null;

const getBrowser = (): Promise<Browser> => {
  sharedBrowser =
    sharedBrowser ??
    chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', ...(process.env.CHROMIUM_SINGLE_PROCESS === '1' ? ['--single-process', '--no-zygote'] : [])],
    });
  return sharedBrowser.then((b) => (b.isConnected() ? b : ((sharedBrowser = null), getBrowser())));
};

export async function closeBrowser(): Promise<void> {
  const b = sharedBrowser;
  sharedBrowser = null;
  await (b ? b.then((x) => x.close()).catch(() => undefined) : Promise.resolve());
}

const MAX_SCREENSHOT_HEIGHT = Number(process.env.MAX_SCREENSHOT_HEIGHT ?? 16000);

export async function scrapeDom(siteUrl: string, viewportWidth: number): Promise<ScrapeResult> {
  const parsed = (() => {
    try {
      return new URL(siteUrl);
    } catch {
      return null;
    }
  })();
  const target = parsed && ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : fail(400, 'Invalid site URL. It must start with http:// or https://');
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: Math.max(320, Math.round(viewportWidth)), height: 900 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  try {
    const page = await context.newPage();
    const response = await page
      .goto(target, { waitUntil: 'load', timeout: 30000 })
      .catch((e: Error) => fail(422, `Target website unreachable or timed out: ${e.message.split('\n')[0]}`));
    response && response.status() >= 400 && fail(422, `Target website responded with HTTP ${response.status()}`);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.waitForTimeout(500);
    await page.evaluate(async () => {
      const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
      const limit = Math.min(document.documentElement.scrollHeight, 30000);
      for (let y = 0; y < limit; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((r) => setTimeout(r, 250));
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(500);

    const nodes = (await page.evaluate(() => {
      const px = (v: string): number => {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : 0;
      };
      const weightMap: Record<string, number> = { normal: 400, bold: 700, lighter: 300, bolder: 800 };
      const cssPath = (el: Element): string => {
        const parts: string[] = [];
        let cur: Element | null = el;
        while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
          const tag = cur.tagName.toLowerCase();
          const id: string = cur.id && /^[A-Za-z][\w-]*$/.test(cur.id) && document.querySelectorAll(`#${cur.id}`).length === 1 ? cur.id : '';
          parts.unshift(id ? `#${id}` : tag);
          const parent: Element | null = cur.parentElement;
          const idx = parent ? Array.prototype.indexOf.call(parent.children, cur) + 1 : 0;
          const needsIdx = !id && parent && parent.children.length > 1;
          parts[0] = needsIdx ? `${tag}:nth-child(${idx})` : parts[0];
          cur = id ? null : parent;
        }
        return parts.join(' > ');
      };
      const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'META', 'LINK', 'HEAD', 'TITLE', 'BR', 'svg', 'PATH']);
      const all = Array.from(document.body.querySelectorAll('*'));
      const out: unknown[] = [];
      let counter = 0;
      all.forEach((el) => {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const visible = !skip.has(el.tagName) && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0 && rect.width > 0 && rect.height > 0;
        const directText = Array.from(el.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        const fontSize = px(cs.fontSize);
        const lh = cs.lineHeight === 'normal' ? fontSize * 1.2 : /px$/.test(cs.lineHeight) ? px(cs.lineHeight) : px(cs.lineHeight) * fontSize;
        const fw = weightMap[cs.fontWeight] ?? (parseInt(cs.fontWeight, 10) || 400);
        const family = (cs.fontFamily.split(',')[0] ?? '').replace(/["']/g, '').trim();
        const fullText = ((el as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim();
        visible &&
          out.push({
            uid: `d${counter++}`,
            tag: el.tagName.toLowerCase(),
            selector: cssPath(el),
            figmaIdAttr: el.getAttribute('data-figma-id'),
            text: directText || null,
            fullText: fullText ? fullText.slice(0, 2000) : null,
            box: { x: rect.left + window.scrollX, y: rect.top + window.scrollY, width: rect.width, height: rect.height },
            padding: { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) },
            margin: { top: px(cs.marginTop), right: px(cs.marginRight), bottom: px(cs.marginBottom), left: px(cs.marginLeft) },
            typography: {
              fontFamily: family,
              fontSize,
              fontWeight: fw,
              lineHeightPx: Math.round(lh * 100) / 100,
              letterSpacing: cs.letterSpacing === 'normal' ? 0 : px(cs.letterSpacing),
            },
          });
      });
      return out;
    })) as NormalizedDomNode[];

    const dims = await page.evaluate(() => ({
      w: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      h: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    }));
    const clipHeight = Math.min(dims.h, MAX_SCREENSHOT_HEIGHT);
    const buffer = await page.screenshot({
      type: 'png',
      fullPage: true,
      clip: { x: 0, y: 0, width: Math.round(viewportWidth), height: clipHeight },
      animations: 'disabled',
    });
    return { nodes, screenshotBase64: buffer.toString('base64'), pageWidth: Math.round(viewportWidth), pageHeight: clipHeight };
  } finally {
    await context.close().catch(() => undefined);
  }
}
