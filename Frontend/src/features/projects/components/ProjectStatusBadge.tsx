import type { WorkStatus } from '../../../mocks/ssaferMockData';

type ProjectStatusBadgeProps = {
  status: WorkStatus;
};

const toneByStatus: Record<WorkStatus, string> = {
  DONE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  ANALYZING: 'border-violet-200 bg-violet-50 text-violet-700',
  FAILED: 'border-rose-200 bg-rose-50 text-rose-700',
  OPEN: 'border-orange-200 bg-orange-50 text-orange-700',
  APPROVED: 'border-slate-200 bg-slate-100 text-slate-700',
  NEW: 'border-sky-200 bg-sky-50 text-sky-700',
  READ: 'border-slate-200 bg-slate-100 text-slate-600',
  ONLINE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  OFFLINE: 'border-slate-200 bg-slate-100 text-slate-600',
};

const labelByStatus: Record<WorkStatus, string> = {
  DONE: '완료',
  ANALYZING: '분석 중',
  FAILED: '실패',
  OPEN: '대응 필요',
  APPROVED: '승인됨',
  NEW: '새 항목',
  READ: '확인됨',
  ONLINE: '온라인',
  OFFLINE: '오프라인',
};

function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold tracking-[0.08em] ${toneByStatus[status]}`}
    >
      {labelByStatus[status]}
    </span>
  );
}

export default ProjectStatusBadge;
