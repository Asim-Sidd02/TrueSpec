import type { AuditReport, AuditRequest } from '@/shared/types';

export const WORKER_URL = (process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:7860').replace(/\/+$/, '');

const friendly: Record<number, string> = {
  400: 'Bad request',
  401: 'Figma token rejected',
  422: 'Website unreachable',
  429: 'Figma rate limit',
  503: 'Worker busy',
};

export async function requestAudit(body: AuditRequest, signal?: AbortSignal): Promise<AuditReport> {
  const res = await fetch(`${WORKER_URL}/api/audit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  }).catch((e: Error) => {
    throw new Error(e.name === 'AbortError' ? 'Audit cancelled.' : `Cannot reach the QA worker at ${WORKER_URL}. Is it running?`);
  });
  const data = await res.json().catch(() => ({ error: `Worker returned HTTP ${res.status}` }));
  return res.ok
    ? (data as AuditReport)
    : Promise.reject(new Error(`${friendly[res.status] ?? `Error ${res.status}`}: ${(data as { error?: string }).error ?? 'Unknown error'}`));
}
