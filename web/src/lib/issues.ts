import type { AuditIssue, Box, IssueCategory } from '@/shared/types';

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  TYPOGRAPHY: 'Typography',
  PADDING: 'Padding',
  MARGIN_SPACING: 'Spacing',
  MISSING_ELEMENT: 'Missing',
};

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as IssueCategory[];

export const SEVERITY_COLORS: Record<AuditIssue['severity'], { stroke: string; fill: string; badge: string }> = {
  error: { stroke: '#ef4444', fill: 'rgba(239,68,68,0.15)', badge: 'bg-red-500/15 text-red-300 ring-red-500/40' },
  warning: { stroke: '#f59e0b', fill: 'rgba(245,158,11,0.15)', badge: 'bg-amber-500/15 text-amber-300 ring-amber-500/40' },
};

export const unitless = new Set(['font-weight', 'font-family', 'text-content']);

export const display = (issue: AuditIssue, v: string | number): string =>
  typeof v === 'number' && !unitless.has(issue.property) ? `${v}px` : String(v);

export const gapBox = (issue: AuditIssue): Box | null =>
  issue.secondaryBox
    ? issue.property === 'vertical-gap'
      ? {
          x: Math.min(issue.highlightBox.x, issue.secondaryBox.x),
          y: issue.highlightBox.y + issue.highlightBox.height,
          width: Math.max(issue.highlightBox.width, issue.secondaryBox.width),
          height: issue.secondaryBox.y - (issue.highlightBox.y + issue.highlightBox.height),
        }
      : {
          x: issue.highlightBox.x + issue.highlightBox.width,
          y: Math.min(issue.highlightBox.y, issue.secondaryBox.y),
          width: issue.secondaryBox.x - (issue.highlightBox.x + issue.highlightBox.width),
          height: Math.max(issue.highlightBox.height, issue.secondaryBox.height),
        }
    : null;

export const normalizeBox = (b: Box): Box => ({
  x: b.width < 0 ? b.x + b.width : b.x,
  y: b.height < 0 ? b.y + b.height : b.y,
  width: Math.abs(b.width),
  height: Math.abs(b.height),
});

export const regionFor = (issue: AuditIssue, pad: number, maxW: number, maxH: number): Box => {
  const boxes = [issue.highlightBox, issue.secondaryBox].filter((b): b is Box => Boolean(b));
  const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
  const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
  const r = Math.min(maxW, Math.max(...boxes.map((b) => b.x + b.width)) + pad);
  const btm = Math.min(maxH, Math.max(...boxes.map((b) => b.y + b.height)) + pad);
  return { x, y, width: Math.max(1, r - x), height: Math.max(1, btm - y) };
};
