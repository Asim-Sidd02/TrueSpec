import http from 'http';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const text = (id, name, characters, x, y, w, h, style) => ({
  id, name, type: 'TEXT', characters,
  absoluteBoundingBox: { x: 1000 + x, y: 2000 + y, width: w, height: h },
  style: { fontFamily: 'Arial', fontWeight: 400, letterSpacing: 0, ...style },
});

const figmaDoc = {
  id: '1:1', name: 'Landing', type: 'FRAME',
  absoluteBoundingBox: { x: 1000, y: 2000, width: 800, height: 600 },
  layoutMode: 'VERTICAL', paddingTop: 40, paddingLeft: 40, paddingRight: 40, paddingBottom: 40, itemSpacing: 24,
  children: [
    text('1:2', 'Hero Title', 'Build better products', 40, 40, 720, 48, { fontSize: 40, fontWeight: 700, lineHeightPx: 48 }),
    text('1:3', 'Hero Subtitle', 'Ship pixel perfect interfaces every time.', 40, 112, 720, 24, { fontSize: 18, lineHeightPx: 24 }),
    {
      id: '1:4', name: 'CTA Button', type: 'INSTANCE',
      absoluteBoundingBox: { x: 1040, y: 2160, width: 160, height: 48 },
      layoutMode: 'HORIZONTAL', paddingTop: 12, paddingBottom: 12, paddingLeft: 24, paddingRight: 24,
      children: [text('1:5', 'CTA Label', 'Get started', 64, 172, 112, 24, { fontSize: 16, fontWeight: 600, lineHeightPx: 24 })],
    },
    text('1:6', 'Missing Copy', 'This text is not on the page', 40, 232, 400, 24, { fontSize: 16, lineHeightPx: 24 }),
  ],
};

const html = `<!doctype html><html><head><style>
body{margin:0;font-family:Arial}
main{width:720px;padding:40px;display:flex;flex-direction:column;align-items:flex-start}
h1{margin:0 0 24px;font-size:40px;line-height:48px;font-weight:700}
p{margin:0 0 40px;font-size:16px;line-height:24px}
a.btn{display:inline-block;padding:8px 24px;font-size:16px;line-height:24px;font-weight:600;background:#222;color:#fff;text-decoration:none}
</style></head><body><main><h1>Build better products</h1><p>Ship pixel perfect interfaces every time.</p><a class="btn" href="#">Get started</a></main></body></html>`;

const server = http.createServer((req, res) => {
  const figma = req.url.startsWith('/v1/files/');
  const authed = req.headers['x-figma-token'] === 'figd_test';
  res.writeHead(figma ? (authed ? 200 : 403) : 200, { 'content-type': figma ? 'application/json' : 'text/html' });
  res.end(figma ? JSON.stringify(authed ? { nodes: { '1:1': { document: figmaDoc } } } : { err: 'forbidden' }) : html);
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
process.env.FIGMA_API_BASE = `http://127.0.0.1:${port}`;
const { runAudit } = require('../dist/audit.js');
const { closeBrowser } = require('../dist/scraper/scrapeDom.js');

const base = { figmaUrl: 'https://www.figma.com/design/abc123XYZ/Test?node-id=1-1', figmaToken: 'figd_test', siteUrl: `http://127.0.0.1:${port}/` };
const report = await runAudit(base);
const has = (cat, prop) => report.issues.some((i) => i.category === cat && i.property === prop);
const expectations = [
  ['font-size on subtitle', has('TYPOGRAPHY', 'font-size')],
  ['padding-top on button', has('PADDING', 'padding-top')],
  ['vertical-gap', has('MARGIN_SPACING', 'vertical-gap')],
  ['missing element', has('MISSING_ELEMENT', 'text-content')],
  ['screenshot present', report.screenshotBase64.length > 1000],
  ['nodes matched >= 4', report.meta.totalNodesChecked >= 4],
];
const badToken = await runAudit({ ...base, figmaToken: 'nope' }).then(() => 0, (e) => e.statusCode);
const badUrl = await runAudit({ ...base, figmaUrl: 'https://www.figma.com/design/abc123XYZ/Test' }).then(() => 0, (e) => e.statusCode);
const badSite = await runAudit({ ...base, siteUrl: 'http://127.0.0.1:1/' }).then(() => 0, (e) => e.statusCode);
expectations.push(['401 on bad token', badToken === 401], ['400 on missing node-id', badUrl === 400], ['422 on unreachable site', badSite === 422]);

const outDir = path.resolve('test-output');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ ...report, screenshotBase64: '<omitted>' }, null, 2));
fs.writeFileSync(path.join(outDir, 'screenshot.png'), Buffer.from(report.screenshotBase64, 'base64'));
console.log(`score=${report.meta.score} matched=${report.meta.totalNodesChecked} issues=${report.issues.length}`);
report.issues.forEach((i) => console.log(`  ${i.severity} ${i.category} ${i.property} ${i.figmaNodeName}: expected ${i.expected} actual ${i.actual}`));
expectations.forEach(([name, ok]) => console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`));
await closeBrowser();
server.close();
process.exit(expectations.every(([, ok]) => ok) ? 0 : 1);
