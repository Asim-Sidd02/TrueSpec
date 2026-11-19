'use client';

import type { AuditIssue, AuditReport } from '@/shared/types';
import { CATEGORY_LABELS, SEVERITY_COLORS, display } from '@/lib/issues';
import { downloadDataUrl, renderDefectCrop } from '@/lib/annotate';
import DefectCrop from './DefectCrop';

interface Props {
  report: AuditReport;
  issue: AuditIssue;
  index: number;
  src: string;
  imageHeight: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

const cssProperty = (issue: AuditIssue): string =>
  ({ 'vertical-gap': 'gap / margin-block', 'horizontal-gap': 'gap / margin-inline', 'text-content': 'content' } as Record<string, string>)[issue.property] ??
  issue.property;

export default function DiffDrawer({ report, issue, index, src, imageHeight, onClose, onPrev, onNext }: Props) {
  const color = SEVERITY_COLORS[issue.severity];
  const save = () =>
    renderDefectCrop(report, issue, `#${index + 1} ${issue.property}`).then((url) => downloadDataUrl(url, `defect-${index + 1}-${issue.property}.png`));
  const copy = () => navigator.clipboard?.writeText(issue.domSelector ?? '');
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto border-t border-white/10 bg-neutral-950/95 shadow-2xl backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-bold text-neutral-400">#{index + 1}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${color.badge}`}>{issue.severity}</span>
            <span className="text-xs uppercase text-neutral-400">{CATEGORY_LABELS[issue.category]}</span>
            <h3 className="truncate text-base font-semibold text-white">{issue.figmaNodeName}</h3>
            <div className="ml-auto flex gap-1">
              <button type="button" onClick={onPrev} className="rounded bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
                ← Prev
              </button>
              <button type="button" onClick={onNext} className="rounded bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
                Next →
              </button>
              <button type="button" onClick={onClose} className="rounded bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
                ✕
              </button>
            </div>
          </div>
          <table className="w-full overflow-hidden rounded-md text-sm ring-1 ring-white/10">
            <thead className="bg-white/5 text-left text-xs uppercase text-neutral-400">
              <tr>
                <th className="px-3 py-2">Property</th>
                <th className="px-3 py-2">Figma (expected)</th>
                <th className="px-3 py-2">Website (actual)</th>
                <th className="px-3 py-2">Δ</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-t border-white/5">
                <td className="px-3 py-2 text-neutral-200">{cssProperty(issue)}</td>
                <td className="px-3 py-2 text-emerald-400">{display(issue, issue.expected)}</td>
                <td className="px-3 py-2 text-red-400">{display(issue, issue.actual)}</td>
                <td className="px-3 py-2 text-neutral-300">{issue.deltaPx === undefined ? '—' : `${issue.deltaPx > 0 ? '+' : ''}${issue.deltaPx}px`}</td>
              </tr>
            </tbody>
          </table>
          <dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-neutral-500">Figma node</dt>
            <dd className="font-mono text-neutral-300">{issue.figmaNodeId}</dd>
            <dt className="text-neutral-500">DOM selector</dt>
            <dd className="flex min-w-0 items-start gap-2">
              <code className="break-all text-neutral-300">{issue.domSelector ?? 'Not found on page'}</code>
              {issue.domSelector && (
                <button type="button" onClick={copy} className="shrink-0 rounded bg-white/5 px-1.5 text-[10px] hover:bg-white/10">
                  copy
                </button>
              )}
            </dd>
            <dt className="text-neutral-500">Location</dt>
            <dd className="font-mono text-neutral-300">
              x {Math.round(issue.highlightBox.x)}, y {Math.round(issue.highlightBox.y)}, {Math.round(issue.highlightBox.width)}×{Math.round(issue.highlightBox.height)}
            </dd>
          </dl>
          <button type="button" onClick={save} className="mt-4 rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400">
            Download defect screenshot
          </button>
        </div>
        <div className="shrink-0">
          <div className="mb-1 text-xs uppercase text-neutral-500">Defect close-up</div>
          <DefectCrop src={src} imageWidth={report.meta.viewportWidth} imageHeight={imageHeight} issue={issue} displayWidth={460} />
        </div>
      </div>
    </div>
  );
}
