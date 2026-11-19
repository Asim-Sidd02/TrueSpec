'use client';

import type { AuditIssue, Box } from '@/shared/types';
import { SEVERITY_COLORS, gapBox, normalizeBox, regionFor } from '@/lib/issues';

interface Props {
  src: string;
  imageWidth: number;
  imageHeight: number;
  issue: AuditIssue;
  displayWidth: number;
  maxScale?: number;
  padding?: number;
}

export default function DefectCrop({ src, imageWidth, imageHeight, issue, displayWidth, maxScale = 3, padding = 32 }: Props) {
  const region = regionFor(issue, padding, imageWidth, imageHeight || Number.MAX_SAFE_INTEGER);
  const scale = Math.min(maxScale, displayWidth / region.width);
  const color = SEVERITY_COLORS[issue.severity];
  const gap = gapBox(issue);
  const place = (b: Box) => {
    const n = normalizeBox(b);
    return { left: (n.x - region.x) * scale, top: (n.y - region.y) * scale, width: Math.max(2, n.width * scale), height: Math.max(2, n.height * scale) };
  };
  return (
    <div
      className="relative overflow-hidden rounded-md bg-neutral-900 ring-1 ring-white/10"
      style={{ width: region.width * scale, height: region.height * scale, maxWidth: '100%' }}
    >
      <img
        src={src}
        alt="Defect region"
        draggable={false}
        className="absolute max-w-none select-none"
        style={{ width: imageWidth * scale, left: -region.x * scale, top: -region.y * scale, imageRendering: scale > 1.5 ? 'pixelated' : 'auto' }}
      />
      <div className="absolute border-2" style={{ ...place(issue.highlightBox), borderColor: color.stroke, background: color.fill }} />
      {issue.secondaryBox && (
        <div className="absolute border-2 border-dashed" style={{ ...place(issue.secondaryBox), borderColor: color.stroke, background: color.fill }} />
      )}
      {gap && <div className="absolute bg-fuchsia-500/40 ring-1 ring-fuchsia-400" style={place(gap)} />}
    </div>
  );
}
