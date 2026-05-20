import type { HttpMethod, TokenRequirement } from '../../constants/apiSpecs';
import type { RiskLevel, WorkStatus } from '../../types/security';

const severityClass: Record<RiskLevel, string> = {
  CRITICAL: 'border-red-200 bg-red-50 text-red-700',
  HIGH: 'border-orange-200 bg-orange-50 text-orange-700',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700',
  LOW: 'border-sky-200 bg-sky-50 text-sky-700',
};

const methodClass: Record<HttpMethod, string> = {
  GET: 'bg-slate-100 text-slate-700',
  POST: 'bg-rose-100 text-rose-700',
  PATCH: 'bg-cyan-100 text-cyan-700',
  DELETE: 'bg-zinc-200 text-zinc-800',
  Socket: 'bg-amber-100 text-amber-800',
};

const tokenClass: Record<TokenRequirement, string> = {
  X: 'border-stone-200 bg-stone-50 text-stone-700',
  O: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'O/G': 'border-cyan-200 bg-cyan-50 text-cyan-700',
  INTERNAL: 'border-rose-200 bg-rose-50 text-rose-700',
};

const statusClass: Record<WorkStatus, string> = {
  DONE: 'bg-emerald-100 text-emerald-800',
  ANALYZING: 'bg-cyan-100 text-cyan-800',
  FAILED: 'bg-zinc-200 text-zinc-800',
  OPEN: 'bg-rose-100 text-rose-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  NEW: 'bg-orange-100 text-orange-800',
  READ: 'bg-slate-100 text-slate-700',
  ONLINE: 'bg-emerald-100 text-emerald-800',
  OFFLINE: 'bg-zinc-200 text-zinc-800',
};

export function SeverityBadge({ value }: { value: RiskLevel }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${severityClass[value]}`}>{value}</span>;
}

export function MethodBadge({ value }: { value: HttpMethod }) {
  return <span className={`rounded-md px-2 py-1 font-mono text-xs font-bold ${methodClass[value]}`}>{value}</span>;
}

export function TokenBadge({ value }: { value: TokenRequirement }) {
  return <span className={`rounded-md border px-2 py-1 text-xs font-bold ${tokenClass[value]}`}>{value}</span>;
}

export function StatusPill({ value }: { value: WorkStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass[value]}`}>{value}</span>;
}

export function DomainBadge({ value }: { value: string }) {
  return <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{value}</span>;
}
