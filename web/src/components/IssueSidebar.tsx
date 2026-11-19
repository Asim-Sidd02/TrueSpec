'use client';

import type { AuditIssue, IssueCategory } from '@/shared/types';
import { CATEGORIES, CATEGORY_LABELS, SEVERITY_COLORS, display } from '@/lib/issues';

export type Filter = IssueCategory | 'ALL';
export type SeverityFilter = AuditIssue['severity'] | 'ALL';

interface Props {
  allIssues: AuditIssue[];
  issues: AuditIssue[];
  indexOf: (id: string) => number;
  filter: Filter;
  severity: SeverityFilter;
  onFilter: (f: Filter) => void;
  onSeverity: (s: SeverityFilter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function IssueSidebar({ allIssues, issues, indexOf, filter, severity, onFilter, onSeverity, selectedId, onSelect }: Props) {
  const count = (c: Filter) => allIssues.filter((i) => c === 'ALL' || i.category === c).length;
  const tabs: Filter[] = ['ALL', ...CATEGORIES];
  const sevs: SeverityFilter[] = ['ALL', 'error', 'warning'];
  return (
    <aside className="flex h-full flex-col">
      <div className="flex flex-wrap gap-1.5 border-b border-white/10 p-3">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onFilter(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === t ? 'bg-indigo-500 text-white' : 'bg-white/5 text-neutral-300 hover:bg-white/10'
            }`}
          >
            {t === 'ALL' ? 'All' : CATEGORY_LABELS[t]} <span className="opacity-70">{count(t)}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 border-b border-white/10 px-3 py-2">
        {sevs.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSeverity(s)}
            className={`rounded px-2 py-0.5 text-[11px] uppercase tracking-wide ${
              severity === s ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {s === 'ALL' ? 'any severity' : s}
          </button>
        ))}
      </div>
      <ul className="flex-1 overflow-y-auto">
        {issues.length === 0 && <li className="p-6 text-center text-sm text-neutral-400">No issues in this filter.</li>}
        {issues.map((issue) => {
          const active = issue.id === selectedId;
          return (
            <li key={issue.id}>
              <button
                type="button"
                onClick={() => onSelect(issue.id)}
                className={`w-full border-b border-white/5 px-3 py-2.5 text-left transition ${active ? 'bg-indigo-500/15' : 'hover:bg-white/5'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-xs font-bold text-neutral-500">#{indexOf(issue.id) + 1}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${SEVERITY_COLORS[issue.severity].badge}`}>
                    {issue.severity}
                  </span>
                  <span className="truncate text-sm font-medium text-neutral-100">{issue.property}</span>
                  <span className="ml-auto shrink-0 text-[10px] uppercase text-neutral-500">{CATEGORY_LABELS[issue.category]}</span>
                </div>
                <div className="mt-1 truncate pl-8 text-xs text-neutral-400">{issue.figmaNodeName}</div>
                <div className="mt-0.5 pl-8 font-mono text-xs">
                  <span className="text-emerald-400">{display(issue, issue.expected)}</span>
                  <span className="text-neutral-500"> → </span>
                  <span className="text-red-400">{display(issue, issue.actual)}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
