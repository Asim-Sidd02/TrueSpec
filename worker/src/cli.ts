#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { runAudit } from './audit';
import { closeBrowser } from './scraper/scrapeDom';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const usage = `Usage: figma-dom-qa --figma <frameUrl> --site <siteUrl> [--token <figmaToken>] [--tolerance 2] [--out ./qa-report] [--min-score 80]
Token may also be provided via FIGMA_TOKEN env variable.`;

const main = async (): Promise<number> => {
  const figmaUrl = flag('figma') ?? '';
  const siteUrl = flag('site') ?? '';
  const figmaToken = flag('token') ?? process.env.FIGMA_TOKEN ?? '';
  const outDir = path.resolve(flag('out') ?? 'qa-report');
  const minScore = Number(flag('min-score') ?? 0);
  const missing = !figmaUrl || !siteUrl || !figmaToken;
  missing && console.error(usage);
  return missing
    ? 2
    : runAudit({ figmaUrl, siteUrl, figmaToken, tolerance: Number(flag('tolerance') ?? 2) }).then((report) => {
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'screenshot.png'), Buffer.from(report.screenshotBase64, 'base64'));
        fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
        const counts = report.issues.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.category]: (acc[i.category] ?? 0) + 1 }), {});
        console.log(`Score: ${report.meta.score}/100   Nodes matched: ${report.meta.totalNodesChecked}   Issues: ${report.issues.length}`);
        Object.entries(counts).forEach(([k, v]) => console.log(`  ${k.padEnd(16)} ${v}`));
        report.issues
          .slice(0, 50)
          .forEach((i) => console.log(`  [${i.severity.toUpperCase()}] ${i.category} ${i.property} "${i.figmaNodeName}" expected ${i.expected} got ${i.actual}`));
        console.log(`Report written to ${outDir}`);
        return report.meta.score >= minScore ? 0 : 1;
      });
};

main()
  .catch((e: Error & { statusCode?: number }) => {
    console.error(`Audit failed${e.statusCode ? ` (${e.statusCode})` : ''}: ${e.message}`);
    return 1;
  })
  .then((code) => closeBrowser().then(() => process.exit(code)));
