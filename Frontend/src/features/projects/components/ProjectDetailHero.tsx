import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BarChart3, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ROUTES } from '../../../constants/routes';

type ProjectDetailHeroProps = {
  projectId: string;
  projectName: string | null;
  description: string | null;
  isLoading: boolean;
  isAgentOnline: boolean;
  isAgentLoading: boolean;
  completedScanCount: number;
  activeScanCount: number;
  failedScanCount: number;
  onStartScan: () => void;
  onCompare: () => void;
  onDelete: () => void;
  canCompare: boolean;
  canDelete: boolean;
};

function AgentChip({ isOnline, isLoading }: { isOnline: boolean; isLoading: boolean }) {
  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 border border-neutral-200 bg-white px-3 py-1 text-[11px] font-bold text-neutral-500 landing-inner-radius">
        <Loader2 className="h-3 w-3 animate-spin" />
        에이전트 확인 중
      </span>
    );
  }

  if (isOnline) {
    return (
      <span className="inline-flex items-center gap-1.5 bg-[#0F0F0F] px-3 py-1 text-[11px] font-bold text-white landing-inner-radius">
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D4FC64] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#D4FC64]" />
        </span>
        에이전트 연결됨
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-1 text-[11px] font-bold text-[#0F0F0F] landing-inner-radius">
      <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
      에이전트 오프라인
    </span>
  );
}

function ProjectDetailHero({
  projectId,
  projectName,
  description,
  isLoading,
  isAgentOnline,
  isAgentLoading,
  completedScanCount,
  activeScanCount,
  failedScanCount,
  onStartScan,
  onCompare,
  onDelete,
  canCompare,
  canDelete,
}: ProjectDetailHeroProps) {
  return (
    <header className="landing-anim space-y-6">
      <Link
        className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 transition hover:text-black"
        state={{ focusProjectId: projectId }}
        to={ROUTES.projects}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        프로젝트 목록
      </Link>

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-[#F4F4F4] p-8 landing-card-radius md:p-10"
        initial={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <AgentChip isLoading={isAgentLoading} isOnline={isAgentOnline} />
          {completedScanCount > 0 ? (
            <span className="inline-flex items-center border border-neutral-200 bg-white px-3 py-1 text-[11px] font-bold text-neutral-600 landing-inner-radius">
              스캔 {completedScanCount}건 완료
            </span>
          ) : null}
        </div>

        <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-[-0.03em] text-[#0F0F0F] md:text-5xl xl:text-6xl">
          {isLoading ? <span className="text-neutral-300">불러오는 중...</span> : (projectName ?? '프로젝트')}
        </h1>

        {description ? <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-500">{description}</p> : null}

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <button
            className="inline-flex items-center gap-2 bg-[#0F0F0F] px-5 py-2.5 text-sm font-bold text-white transition landing-inner-radius hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.18)]"
            onClick={onStartScan}
            type="button"
          >
            새 스캔 시작
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            className="inline-flex items-center gap-2 border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold text-neutral-700 transition landing-inner-radius hover:border-neutral-400 hover:text-[#0F0F0F] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-neutral-200 disabled:hover:text-neutral-700"
            disabled={!canCompare}
            onClick={onCompare}
            title={canCompare ? '히스토리 페이지에서 프로젝트 스캔 결과를 비교합니다.' : '비교하려면 완료된 스캔이 2개 이상 필요합니다.'}
            type="button"
          >
            <BarChart3 className="h-4 w-4" />
            결과 비교
          </button>
          {canDelete ? (
            <button
              className="inline-flex items-center gap-1 px-3 py-2.5 text-sm font-bold text-rose-500 transition landing-inner-radius hover:bg-rose-50 hover:text-rose-600"
              onClick={onDelete}
              type="button"
            >
              삭제
            </button>
          ) : null}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatTile accent="sky" isActive={activeScanCount > 0} label="진행 중" spinning={activeScanCount > 0} value={activeScanCount} />
        <StatTile accent="lime" isActive={completedScanCount > 0} label="완료" value={completedScanCount} />
        <StatTile accent="rose" isActive={failedScanCount > 0} label="실패 / 취소" value={failedScanCount} />
      </div>
    </header>
  );
}

const accentMap = {
  sky: {
    bg: 'bg-[#EEF1F9]',
    iconWrap: 'bg-[#A5B7EC] text-white',
    valueText: 'text-[#5E72C4]',
  },
  lime: {
    bg: 'bg-[#F4FFD9]',
    iconWrap: 'bg-[#E2F9A0] text-[#4A7A00]',
    valueText: 'text-[#4A7A00]',
  },
  rose: {
    bg: 'bg-rose-50',
    iconWrap: 'bg-rose-100 text-rose-600',
    valueText: 'text-rose-700',
  },
} as const;

type StatTileProps = {
  accent: keyof typeof accentMap;
  label: string;
  value: number;
  isActive: boolean;
  spinning?: boolean;
};

function StatTile({ accent, label, value, isActive, spinning }: StatTileProps) {
  const theme = accentMap[accent];
  const Icon = accent === 'sky' ? Loader2 : accent === 'lime' ? CheckCircle2 : ShieldAlert;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3.5 border border-neutral-200/80 p-5 landing-card-radius transition ${
        isActive ? theme.bg : 'bg-white'
      }`}
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
          isActive ? theme.iconWrap : 'bg-neutral-100 text-neutral-300'
        }`}
      >
        <Icon className={`h-4 w-4 ${spinning && isActive ? 'animate-spin' : ''}`} />
      </div>
      <div>
        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-neutral-400">{label}</p>
        <p className={`text-2xl font-black leading-tight tabular-nums ${isActive ? theme.valueText : 'text-neutral-300'}`}>
          {value}
        </p>
      </div>
    </motion.div>
  );
}

export default ProjectDetailHero;
