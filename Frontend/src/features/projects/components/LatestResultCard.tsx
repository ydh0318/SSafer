import { motion } from 'framer-motion';
import { ArrowRight, Clock4 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ROUTES } from '../../../constants/routes';
import type { ProjectScanListItemData, ScanSummaryData } from '../../../types/scan';
import { formatCompactDateTime, getScanModeLabel } from '../../scans/utils/scanPresentation';
import SeverityBlock from './SeverityBlock';

type LatestResultCardProps = {
  scan: ProjectScanListItemData | null;
  summary: ScanSummaryData | null;
  isLoading: boolean;
  projectId: string;
};

function ScanTypeLabel(scanType: string | undefined) {
  if (scanType === 'PROJECT_FILE') return '프로젝트 스캔';
  if (scanType === 'SERVER_AUDIT') return '서버 점검';
  return scanType ?? '-';
}

function LatestResultCard({ scan, summary, isLoading, projectId }: LatestResultCardProps) {
  if (isLoading) {
    return (
      <div className="border border-neutral-200/60 bg-white/20 p-8 text-sm text-neutral-500 backdrop-blur-sm landing-card-radius">
        최근 결과를 불러오는 중입니다.
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="flex flex-col items-center gap-3 border border-dashed border-neutral-300 bg-white/40 p-10 text-center backdrop-blur-sm landing-card-radius">
        <Clock4 className="h-7 w-7 text-neutral-300" />
        <p className="text-sm font-bold text-neutral-700">아직 완료된 스캔이 없습니다</p>
        <p className="text-xs text-neutral-500">새 스캔을 시작하면 결과가 여기 나타납니다.</p>
      </div>
    );
  }

  const totalFindings = summary?.totalFindings ?? 0;
  const resolved =
    summary?.resolutionCounts?.RESOLVED ?? summary?.resolutionCounts?.IGNORED ?? 0;
  const sourceEntries = Object.entries(summary?.sourceCounts ?? {});

  return (
    <motion.article
      animate={{ opacity: 1, y: 0 }}
      className="border border-neutral-200/60 bg-white/20 p-7 backdrop-blur-sm landing-card-radius md:p-8"
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/60 pb-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center bg-[#0F0F0F] px-2.5 py-1 font-mono text-[11px] font-bold text-white landing-inner-radius">
            #{scan.scanId}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#4A7A00]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7CB300]" />
            완료
          </span>
          <span className="text-xs text-neutral-500">
            {formatCompactDateTime(scan.completedAt ?? scan.requestedAt)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-neutral-200 bg-white px-3 py-1 font-mono text-[11px] font-bold text-neutral-700 landing-inner-radius">
            {getScanModeLabel(scan.scanMode)}
          </span>
          <span className="border border-neutral-200 bg-white px-3 py-1 font-mono text-[11px] font-bold text-neutral-700 landing-inner-radius">
            {ScanTypeLabel(scan.scanType ?? undefined)}
          </span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SeverityBlock label="CRITICAL" tone="critical" value={summary?.criticalCount ?? 0} />
        <SeverityBlock label="HIGH" tone="high" value={summary?.highCount ?? 0} />
        <SeverityBlock label="MEDIUM" tone="medium" value={summary?.mediumCount ?? 0} />
        <SeverityBlock label="LOW" tone="low" value={summary?.lowCount ?? 0} />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-6 md:max-w-2xl">
        <Stat label="총 탐지" value={`${totalFindings}건`} />
        <Stat label="해결 완료" value={`${resolved}건`} valueClass="text-[#4A7A00]" />
        {sourceEntries.length > 0 ? (
          <Stat
            label="소스"
            value={sourceEntries.map(([s, c]) => `${s} ${c}`).join(' · ')}
            valueClass="text-[#0F0F0F]"
          />
        ) : <Stat label="소스" value="-" />}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          className="inline-flex items-center gap-2 bg-[#0F0F0F] px-5 py-2.5 text-sm font-bold text-white transition landing-inner-radius hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.18)]"
          state={{ projectId }}
          to={ROUTES.resultDetail.replace(':scanId', String(scan.scanId))}
        >
          결과 체크리스트 보기
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.article>
  );
}

function Stat({ label, value, valueClass = 'text-[#0F0F0F]' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-neutral-400">{label}</p>
      <p className={`mt-1.5 text-base font-black tracking-tight ${valueClass}`}>{value}</p>
    </div>
  );
}

export default LatestResultCard;
