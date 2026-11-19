'use client';

import { useEffect, useRef, useState } from 'react';
import type { AuditIssue, Box } from '@/shared/types';
import { SEVERITY_COLORS, gapBox, normalizeBox } from '@/lib/issues';

interface Props {
  src: string;
  imageWidth: number;
  issues: AuditIssue[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onImageSize: (w: number, h: number) => void;
}

export default function VisualOverlay({ src, imageWidth, issues, selectedId, onSelect, onImageSize }: Props) {
  const [natural, setNatural] = useState({ w: imageWidth, h: 0 });
  const boxRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const el = selectedId ? boxRefs.current[selectedId] : null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [selectedId]);

  const pct = (b: Box) => {
    const n = normalizeBox(b);
    return {
      left: `${(n.x / natural.w) * 100}%`,
      top: `${(n.y / Math.max(1, natural.h)) * 100}%`,
      width: `${(Math.max(2, n.width) / natural.w) * 100}%`,
      height: `${(Math.max(2, n.height) / Math.max(1, natural.h)) * 100}%`,
    };
  };

  return (
    <div className="relative w-full">
      <img
        src={src}
        alt="Full page screenshot"
        className="block w-full select-none"
        draggable={false}
        onLoad={(e) => {
          const t = e.currentTarget;
          setNatural({ w: t.naturalWidth, h: t.naturalHeight });
          onImageSize(t.naturalWidth, t.naturalHeight);
        }}
      />
      {natural.h > 0 &&
        issues.map((issue, i) => {
          const color = SEVERITY_COLORS[issue.severity];
          const active = issue.id === selectedId;
          const gap = gapBox(issue);
          const visible = !selectedId || active;
          return (
            <div key={issue.id} style={{ opacity: visible ? 1 : 0.35 }}>
              <button
                ref={(el) => {
                  boxRefs.current[issue.id] = el;
                }}
                type="button"
                title={`${issue.property}: expected ${issue.expected}, actual ${issue.actual}`}
                onClick={() => onSelect(issue.id)}
                className="absolute cursor-pointer transition-shadow"
                style={{
                  ...pct(issue.highlightBox),
                  border: `${active ? 3 : 2}px solid ${color.stroke}`,
                  background: color.fill,
                  boxShadow: active ? `0 0 0 4px ${color.stroke}55` : 'none',
                  zIndex: active ? 30 : 10,
                }}
              >
                <span
                  className="absolute -top-5 left-0 whitespace-nowrap rounded px-1 text-[10px] font-bold leading-4 text-white"
                  style={{ background: color.stroke }}
                >
                  {i + 1}
                </span>
              </button>
              {issue.secondaryBox && (
                <div
                  className="pointer-events-none absolute border-2 border-dashed"
                  style={{ ...pct(issue.secondaryBox), borderColor: color.stroke, background: color.fill, zIndex: active ? 29 : 9 }}
                />
              )}
              {gap && (
                <div className="pointer-events-none absolute bg-fuchsia-500/40 ring-1 ring-fuchsia-400" style={{ ...pct(gap), zIndex: active ? 31 : 11 }} />
              )}
            </div>
          );
        })}
    </div>
  );
}
