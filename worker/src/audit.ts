import { AuditReport, AuditRequest } from './shared/types';
import { parseFigmaUrl } from './figma/parseUrl';
import { fetchFigmaRoot, normalizeFigmaTree } from './figma/fetchNodes';
import { scrapeDom } from './scraper/scrapeDom';
import { matchNodes } from './engine/matcher';
import { diffNodes } from './engine/differ';
import { fail } from './errors';

const severityRank: Record<string, number> = { error: 0, warning: 1 };

export async function runAudit(req: AuditRequest): Promise<AuditReport> {
  const siteUrl = String(req.siteUrl ?? '').trim() || fail(400, 'Missing siteUrl.');
  const rawTol = Number(req.tolerance);
  const tolerance = Number.isFinite(rawTol) && rawTol >= 0 && req.tolerance !== null && req.tolerance !== undefined ? rawTol : 2;
  const { fileKey, nodeId } = parseFigmaUrl(req.figmaUrl);
  const root = await fetchFigmaRoot(fileKey, nodeId, req.figmaToken);
  const figmaNodes = normalizeFigmaTree(root);
  const viewportWidth = Math.round(figmaNodes[0].relativeBox.width);
  const scraped = await scrapeDom(siteUrl, viewportWidth);
  const matches = matchNodes(figmaNodes, scraped.nodes);
  const { issues, checks } = diffNodes(figmaNodes, matches, tolerance);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  const score = checks > 0 ? Math.max(0, Math.round(100 * (1 - (errors + warnings * 0.5) / checks))) : 0;
  issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.highlightBox.y - b.highlightBox.y);
  return {
    meta: {
      figmaUrl: req.figmaUrl,
      siteUrl,
      viewportWidth,
      timestamp: new Date().toISOString(),
      totalNodesChecked: matches.size,
      score,
    },
    screenshotBase64: scraped.screenshotBase64,
    issues,
  };
}
