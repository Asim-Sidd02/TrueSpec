'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AuditReport } from '@/shared/types';
import { requestAudit, WORKER_URL } from '@/lib/api';
import { downloadDataUrl, renderAnnotated, screenshotSrc } from '@/lib/annotate';
import { CATEGORIES, CATEGORY_LABELS, SEVERITY_COLORS, display } from '@/lib/issues';
import VisualOverlay from '@/components/VisualOverlay';
import IssueSidebar, { Filter, SeverityFilter } from '@/components/IssueSidebar';
import DiffDrawer from '@/components/DiffDrawer';
import DefectCrop from '@/components/DefectCrop';

const TOKEN_KEY = 'figma-dom-qa:token';
const FORM_KEY = 'figma-dom-qa:form';

const safeGet = (key: string): string => {
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};

const safeSet = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
};

const scoreColor = (s: number): string => (s >= 90 ? 'text-emerald-400' : s >= 70 ? 'text-amber-400' : 'text-red-400');

export default function Home() {
  const [figmaUrl, setFigmaUrl] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [figmaToken, setFigmaToken] = useState('');
  const [tolerance, setTolerance] = useState(2);
  const [rememberToken, setRememberToken] = useState(true);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [severity, setSeverity] = useState<SeverityFilter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageHeight, setImageHeight] = useState(0);
  const [view, setView] = useState<'inspector' | 'gallery'>('inspector');
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const saved = (() => {
      try {
        return JSON.parse(safeGet(FORM_KEY) || '{}') as { figmaUrl?: string; siteUrl?: string; tolerance?: number };
      } catch {
        return {};
      }
    })();
    setFigmaToken(safeGet(TOKEN_KEY));
    setFigmaUrl(saved.figmaUrl ?? '');
    setSiteUrl(saved.siteUrl ?? '');
    setTolerance(saved.tolerance ?? 2);
  }, []);

  useEffect(() => {
    const timer = loading ? window.setInterval(() => setElapsed((e) => e + 1), 1000) : undefined;
    return () => window.clearInterval(timer);
  }, [loading]);

  const issues = report?.issues ?? [];
  const filtered = useMemo(
    () => issues.filter((i) => (filter === 'ALL' || i.category === filter) && (severity === 'ALL' || i.severity === severity)),
    [issues, filter, severity],
  );
  const indexMap = useMemo(() => new Map(issues.map((i, idx) => [i.id, idx])), [issues]);
  const indexOf = (id: string) => indexMap.get(id) ?? 0;
  const selected = issues.find((i) => i.id === selectedId) ?? null;
  const src = report ? screenshotSrc(report) : '';

  const step = (dir: 1 | -1) => {
    const pos = filtered.findIndex((i) => i.id === selectedId);
    const next = filtered[(pos + dir + filtered.length) % Math.max(1, filtered.length)];
    next && setSelectedId(next.id);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    safeSet(TOKEN_KEY, rememberToken ? figmaToken : '');
    safeSet(FORM_KEY, JSON.stringify({ figmaUrl, siteUrl, tolerance }));
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setElapsed(0);
    setError(null);
    setSelectedId(null);
    await requestAudit({ figmaUrl: figmaUrl.trim(), figmaToken: figmaToken.trim(), siteUrl: siteUrl.trim(), tolerance }, controller.signal)
      .then((r) => {
        setReport(r);
        setFilter('ALL');
        setSeverity('ALL');
        setView('inspector');
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const loadReportFile = (file: File | undefined) => {
    file &&
      file
        .text()
        .then((t) => JSON.parse(t) as AuditReport)
        .then((r) => (r?.screenshotBase64 && Array.isArray(r.issues) ? (setReport(r), setSelectedId(null), setError(null)) : Promise.reject(new Error())))
        .catch(() => setError('That file is not a valid audit report JSON.'));
  };

  const exportJson = () =>
    report && downloadDataUrl(`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(report))}`, `qa-report-${Date.now()}.json`);

  const exportAnnotated = () => report && renderAnnotated(report, issues).then((url) => downloadDataUrl(url, `qa-annotated-${Date.now()}.png`));

  const errors = issues.filter((i) => i.severity === 'error').length;

  return (
    <main className="min-h-screen pb-80">
      <header className="border-b border-white/10 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-black">QA</div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Figma → DOM Visual QA</h1>
            <p className="text-xs text-neutral-400">Typography, padding and spacing diff against your design</p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-neutral-500">
            <span className="hidden sm:inline">Worker: {WORKER_URL}</span>
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded bg-white/5 px-2 py-1 text-neutral-300 hover:bg-white/10">
              Open report JSON
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => loadReportFile(e.target.files?.[0])} />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1600px] px-4 py-4">
        <form onSubmit={submit} className="grid gap-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10 md:grid-cols-12">
          <label className="md:col-span-5">
            <span className="mb-1 block text-xs font-medium text-neutral-400">Figma Frame URL (must include node-id)</span>
            <input
              required
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="https://www.figma.com/design/abc123/My-Site?node-id=12-345"
              className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-indigo-500"
            />
          </label>
          <label className="md:col-span-4">
            <span className="mb-1 block text-xs font-medium text-neutral-400">Live / Staging Website URL</span>
            <input
              required
              type="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://my-staging-site.vercel.app"
              className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-indigo-500"
            />
          </label>
          <label className="md:col-span-3">
            <span className="mb-1 block text-xs font-medium text-neutral-400">Tolerance (px)</span>
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-indigo-500"
            />
          </label>
          <label className="md:col-span-9">
            <span className="mb-1 block text-xs font-medium text-neutral-400">Figma Personal Access Token</span>
            <input
              required
              type="password"
              autoComplete="off"
              value={figmaToken}
              onChange={(e) => setFigmaToken(e.target.value)}
              placeholder="figd_xxxxxxxxxxxxxxxx"
              className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-indigo-500"
            />
            <span className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
              <input type="checkbox" checked={rememberToken} onChange={(e) => setRememberToken(e.target.checked)} />
              Remember token in this browser (localStorage only, never sent anywhere except your worker)
            </span>
          </label>
          <div className="flex items-end gap-2 md:col-span-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? `Auditing… ${elapsed}s` : 'Run audit'}
            </button>
            {loading && (
              <button type="button" onClick={() => abortRef.current?.abort()} className="rounded-md bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                Cancel
              </button>
            )}
          </div>
        </form>

        {error && <div className="mt-3 rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/30">{error}</div>}

        {loading && (
          <div className="mt-6 rounded-xl bg-white/[0.03] p-8 text-center ring-1 ring-white/10">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            <p className="text-sm text-neutral-300">Fetching Figma frame, rendering the site in Chromium and comparing elements…</p>
            <p className="mt-1 text-xs text-neutral-500">This usually takes 10–60 seconds.</p>
          </div>
        )}

        {!report && !loading && (
          <div className="mt-6 rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-neutral-400">
            Paste a Figma frame link, your website URL and a Figma token, then run the audit. Defects will be highlighted on a full-page screenshot.
          </div>
        )}
      </section>

      {report && !loading && (
        <section className="mx-auto max-w-[1600px] px-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <div className="text-xs uppercase text-neutral-500">Score</div>
              <div className={`text-3xl font-bold ${scoreColor(report.meta.score)}`}>{report.meta.score}</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10">
              <div className="text-xs uppercase text-neutral-500">Issues</div>
              <div className="text-3xl font-bold">{issues.length}</div>
              <div className="text-xs text-neutral-500">
                <span className="text-red-400">{errors} errors</span> · <span className="text-amber-400">{issues.length - errors} warnings</span>
              </div>
            </div>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                className={`rounded-xl p-4 text-left ring-1 transition ${filter === c ? 'bg-indigo-500/10 ring-indigo-500/50' : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]'}`}
              >
                <div className="text-xs uppercase text-neutral-500">{CATEGORY_LABELS[c]}</div>
                <div className="text-3xl font-bold">{issues.filter((i) => i.category === c).length}</div>
              </button>
            ))}
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
            <span>
              {report.meta.siteUrl} · viewport {report.meta.viewportWidth}px · {report.meta.totalNodesChecked} nodes matched ·{' '}
              {new Date(report.meta.timestamp).toLocaleString()}
            </span>
            <div className="ml-auto flex gap-2">
              <div className="flex overflow-hidden rounded-md ring-1 ring-white/10">
                {(['inspector', 'gallery'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`px-3 py-1.5 capitalize ${view === v ? 'bg-indigo-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}
                  >
                    {v === 'gallery' ? 'Defect screenshots' : 'Page inspector'}
                  </button>
                ))}
              </div>
              <button type="button" onClick={exportAnnotated} className="rounded-md bg-white/5 px-3 py-1.5 hover:bg-white/10">
                Download annotated PNG
              </button>
              <button type="button" onClick={exportJson} className="rounded-md bg-white/5 px-3 py-1.5 hover:bg-white/10">
                Export JSON
              </button>
            </div>
          </div>

          {view === 'inspector' ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
              <div className="max-h-[calc(100vh-120px)] overflow-auto rounded-xl bg-neutral-900 p-6 ring-1 ring-white/10">
                <VisualOverlay
                  src={src}
                  imageWidth={report.meta.viewportWidth}
                  issues={filtered}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onImageSize={(_w, h) => setImageHeight(h)}
                />
              </div>
              <div className="h-[calc(100vh-120px)] overflow-hidden rounded-xl bg-white/[0.03] ring-1 ring-white/10 lg:sticky lg:top-4">
                <IssueSidebar
                  allIssues={issues}
                  issues={filtered}
                  indexOf={indexOf}
                  filter={filter}
                  severity={severity}
                  onFilter={setFilter}
                  onSeverity={setSeverity}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.length === 0 && <div className="col-span-full p-10 text-center text-sm text-neutral-400">No defects in this filter.</div>}
              {filtered.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => setSelectedId(issue.id)}
                  className={`flex flex-col gap-2 rounded-xl bg-white/[0.03] p-3 text-left ring-1 transition hover:bg-white/[0.06] ${
                    issue.id === selectedId ? 'ring-indigo-500' : 'ring-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-neutral-500">#{indexOf(issue.id) + 1}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ${SEVERITY_COLORS[issue.severity].badge}`}>
                      {issue.severity}
                    </span>
                    <span className="font-medium text-neutral-100">{issue.property}</span>
                    <span className="ml-auto truncate text-neutral-500">{issue.figmaNodeName}</span>
                  </div>
                  <div className="grid place-items-center overflow-hidden rounded-md bg-neutral-950 p-2">
                    <DefectCrop src={src} imageWidth={report.meta.viewportWidth} imageHeight={imageHeight} issue={issue} displayWidth={420} maxScale={2} />
                  </div>
                  <div className="font-mono text-xs">
                    <span className="text-neutral-500">expected </span>
                    <span className="text-emerald-400">{display(issue, issue.expected)}</span>
                    <span className="text-neutral-500"> · actual </span>
                    <span className="text-red-400">{display(issue, issue.actual)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {report && selected && (
        <DiffDrawer
          report={report}
          issue={selected}
          index={indexOf(selected.id)}
          src={src}
          imageHeight={imageHeight}
          onClose={() => setSelectedId(null)}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
        />
      )}
    </main>
  );
}
