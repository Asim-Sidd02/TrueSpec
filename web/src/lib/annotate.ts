import type { AuditIssue, AuditReport, Box } from '@/shared/types';
import { SEVERITY_COLORS, gapBox, normalizeBox, regionFor } from './issues';

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load screenshot'));
    img.src = src;
  });

const drawIssue = (ctx: CanvasRenderingContext2D, issue: AuditIssue, offset: Box, scale: number, label: string): void => {
  const color = SEVERITY_COLORS[issue.severity];
  const rect = (b: Box, dashed: boolean): void => {
    const n = normalizeBox(b);
    ctx.setLineDash(dashed ? [6, 4] : []);
    ctx.fillStyle = color.fill;
    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = 2;
    ctx.fillRect((n.x - offset.x) * scale, (n.y - offset.y) * scale, n.width * scale, n.height * scale);
    ctx.strokeRect((n.x - offset.x) * scale, (n.y - offset.y) * scale, n.width * scale, n.height * scale);
  };
  rect(issue.highlightBox, false);
  issue.secondaryBox && rect(issue.secondaryBox, true);
  const gap = gapBox(issue);
  gap && ((ctx.fillStyle = 'rgba(217,70,239,0.35)'), (() => {
    const n = normalizeBox(gap);
    ctx.fillRect((n.x - offset.x) * scale, (n.y - offset.y) * scale, Math.max(2, n.width * scale), Math.max(2, n.height * scale));
  })());
  ctx.setLineDash([]);
  ctx.font = 'bold 12px ui-sans-serif, system-ui, sans-serif';
  const tw = ctx.measureText(label).width + 10;
  const lx = Math.max(0, (issue.highlightBox.x - offset.x) * scale);
  const ly = Math.max(0, (issue.highlightBox.y - offset.y) * scale - 18);
  ctx.fillStyle = color.stroke;
  ctx.fillRect(lx, ly, tw, 18);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, lx + 5, ly + 13);
};

export const screenshotSrc = (report: AuditReport): string => `data:image/png;base64,${report.screenshotBase64}`;

export async function renderAnnotated(report: AuditReport, issues: AuditIssue[]): Promise<string> {
  const img = await loadImage(screenshotSrc(report));
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.drawImage(img, 0, 0);
  issues.forEach((issue, i) => drawIssue(ctx, issue, { x: 0, y: 0, width: 0, height: 0 }, 1, `#${i + 1} ${issue.property}`));
  return canvas.toDataURL('image/png');
}

export async function renderDefectCrop(report: AuditReport, issue: AuditIssue, label: string): Promise<string> {
  const img = await loadImage(screenshotSrc(report));
  const region = regionFor(issue, 40, img.naturalWidth, img.naturalHeight);
  const scale = Math.min(3, Math.max(1, 640 / region.width));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(region.width * scale);
  canvas.height = Math.round(region.height * scale);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, region.x, region.y, region.width, region.height, 0, 0, canvas.width, canvas.height);
  drawIssue(ctx, issue, region, scale, label);
  return canvas.toDataURL('image/png');
}

export const downloadDataUrl = (dataUrl: string, filename: string): void => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};
