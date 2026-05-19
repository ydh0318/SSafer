import { motion } from 'framer-motion';
import { ArrowRight, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ROUTES } from '../../../constants/routes';
import type { ScanMode, ScanRequestSource, ScanStatus, ScanType } from '../../../types/scan';
import {
  canDeleteScanHistory,
  formatCompactDateTime,
  getDeleteBlockedReason,
  getScanModeLabel,
  getScanStatusLabel,
} from '../utils/scanPresentation';

export type ScanTimelineItem = {
  scanId: number;
  status: ScanStatus;
  scanMode: ScanMode;
  scanType?: ScanType;
  source?: ScanRequestSource | null;
  requestedAt: string;
  completedAt: string | null;
  /** 히스토리 페이지에서 표시되는 프로젝트 ID */
  projectId?: number;
  projectName?: string;
  /** 히스토리 페이지에서 표시되는 심각도 카운트 */
  severity?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
};

type ScanTimelineProps = {
  items: ScanTimelineItem[];
  isLoading: boolean;
  errorMessage?: string | null;
  emptyMessage?: string;
  deletingScanIds?: number[];
  onDeleteScan?: (scanId: number) => void;
  /** 라우팅 state에 함께 전달할 projectId (단일 프로젝트 컨텍스트일 때) */
  routeProjectId?: string;
  /** 각 행에 프로젝트 ID 칩을 표시할지 (히스토리 페이지에서 true) */
  showProjectChip?: boolean;
  /** 타임라인 점의 ring 색 — 배경에 따라 조정 */
  ringColor?: string;
  /**
   * 표시 형태
   * - 'detailed' (기본): 타임라인 점·세로선·각 행에 진행상태/결과보기/삭제 버튼
   * - 'compact':  타임라인 점 없음·버튼 없음·카드 전체가 onItemClick으로 동작
   */
  variant?: 'detailed' | 'compact';
  /** compact 모드에서 각 항목의 표시용 이름을 반환 (보통 프로젝트명) */
  getDisplayName?: (item: ScanTimelineItem) => string | null;
  /** compact 모드에서 카드 클릭 시 호출 */
  onItemClick?: (item: ScanTimelineItem) => void;
};

function statusTone(status: ScanStatus) {
  if (status === 'DONE') return { dot: 'bg-[#7CB300]', chip: 'bg-[#F0FFD0] text-[#4A7A00]' };
  if (status === 'RUNNING' || status === 'QUEUED' || status === 'REQUESTED' || status === 'RAW_UPLOADED') {
    return { dot: 'bg-[#A5B7EC] animate-pulse', chip: 'bg-[#EEF1F9] text-[#5E72C4]' };
  }
  if (status === 'FAILED' || status === 'CANCELED') return { dot: 'bg-rose-400', chip: 'bg-rose-50 text-rose-700' };
  return { dot: 'bg-neutral-400', chip: 'bg-neutral-100 text-neutral-600' };
}

function scanTypeLabel(scanType: string | undefined) {
  if (scanType === 'PROJECT_FILE') return '프로젝트 스캔';
  if (scanType === 'SERVER_AUDIT') return '서버 점검';
  return null;
}

const severityPillClasses: Array<{
  key: 'critical' | 'high' | 'medium' | 'low';
  label: string;
  cls: string;
  dot: string;
}> = [
  { key: 'critical', label: 'C', cls: 'border-red-200 bg-red-50 text-red-700',       dot: 'bg-red-500' },
  { key: 'high',     label: 'H', cls: 'border-orange-200 bg-orange-50 text-orange-700', dot: 'bg-orange-400' },
  { key: 'medium',   label: 'M', cls: 'border-yellow-200 bg-yellow-50 text-yellow-700', dot: 'bg-yellow-400' },
  { key: 'low',      label: 'L', cls: 'border-blue-200 bg-blue-50 text-blue-600',     dot: 'bg-blue-400' },
];

function ScanTimeline({
  items,
  isLoading,
  errorMessage,
  emptyMessage = '현재 조건에 맞는 스캔이 없습니다.',
  deletingScanIds = [],
  onDeleteScan,
  routeProjectId,
  showProjectChip = false,
  ringColor = '#FAFAFA',
  variant = 'detailed',
  getDisplayName,
  onItemClick,
}: ScanTimelineProps) {
  const isCompact = variant === 'compact';
  if (isLoading) {
    return (
      <div className="border border-neutral-200/60 bg-white/20 px-5 py-6 text-sm text-neutral-500 backdrop-blur-sm landing-card-radius">
        스캔 이력을 불러오는 중입니다...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="border border-rose-200 bg-rose-50 px-5 py-5 text-sm text-rose-700 landing-card-radius">
        {errorMessage}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-neutral-300 bg-white/15 px-5 py-10 text-center text-sm text-neutral-500 backdrop-blur-sm landing-card-radius">
        {emptyMessage}
      </div>
    );
  }

  const listClassName = isCompact ? 'relative space-y-2' : 'relative space-y-3 pl-8';

  return (
    <ol className={listClassName}>
      {/* 타임라인 세로선 (detailed 전용) */}
      {!isCompact ? (
        <span aria-hidden className="absolute bottom-3 left-2 top-3 w-px bg-neutral-200" />
      ) : null}

      {items.map((scan, idx) => {
        const tone = statusTone(scan.status);
        const isDeleting = deletingScanIds.includes(scan.scanId);
        const isDeleteAllowed = canDeleteScanHistory(scan.status);
        const deleteBlockedReason = getDeleteBlockedReason(scan.status);
        const typeLabel = scanTypeLabel(scan.scanType ?? undefined);
        const linkState = routeProjectId ? { projectId: routeProjectId } : undefined;
        const displayName = getDisplayName ? getDisplayName(scan) : null;

        const totalSeverity =
          (scan.severity?.critical ?? 0) +
          (scan.severity?.high ?? 0) +
          (scan.severity?.medium ?? 0) +
          (scan.severity?.low ?? 0);

        const cardBase =
          'border border-neutral-200/60 bg-white/20 backdrop-blur-sm transition landing-card-radius hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-white/50 hover:shadow-[0_14px_32px_rgba(15,23,42,0.06)]';
        const cardSizing = isCompact ? 'w-full p-4 text-left' : 'p-5';

        // Compact 모드: 카드가 button 또는 div 로 동작
        const compactContent = (
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2 lg:flex-nowrap">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {displayName ? (
                <span className="truncate text-base font-black text-[#0F0F0F]">{displayName}</span>
              ) : null}
              <span className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-bold landing-inner-radius ${tone.chip}`}>
                {getScanStatusLabel(scan.status)}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-neutral-400">#{scan.scanId}</span>
              <span className="hidden text-neutral-200 sm:inline">·</span>
              <span className="hidden shrink-0 text-[11px] text-neutral-500 sm:inline">
                {getScanModeLabel(scan.scanMode, scan.source)}
              </span>
              {typeLabel ? (
                <>
                  <span className="hidden text-neutral-200 lg:inline">·</span>
                  <span className="hidden shrink-0 text-[11px] text-neutral-500 lg:inline">{typeLabel}</span>
                </>
              ) : null}
              </div>
              <span className="font-mono text-[11px] text-neutral-400">
                {formatCompactDateTime(scan.completedAt ?? scan.requestedAt)}
              </span>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {scan.severity && scan.status === 'DONE' ? (
                totalSeverity === 0 ? (
                  <span className="rounded border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-bold text-neutral-400">
                    이슈 없음
                  </span>
                ) : (
                  severityPillClasses.map((pill) => {
                    const count = scan.severity?.[pill.key] ?? 0;
                    if (count === 0) return null;
                    return (
                      <span
                        key={pill.key}
                        className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-bold ${pill.cls}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
                        {pill.label} {count}
                      </span>
                    );
                  })
                )
              ) : null}
            </div>
          </div>
        );

        return (
          <motion.li
            animate={{ opacity: 1, x: 0 }}
            className="relative"
            initial={{ opacity: 0, x: -8 }}
            key={scan.scanId}
            transition={{ duration: 0.3, delay: idx * 0.03, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* 타임라인 점 (detailed 전용) */}
            {!isCompact ? (
              <span
                aria-hidden
                className={`absolute -left-[26px] top-6 inline-flex h-3 w-3 items-center justify-center rounded-full ${tone.dot}`}
                style={{ boxShadow: `0 0 0 4px ${ringColor}` }}
              />
            ) : null}

            {isCompact ? (
              onItemClick ? (
                <button
                  className={`${cardBase} ${cardSizing} flex items-center`}
                  onClick={() => onItemClick(scan)}
                  type="button"
                >
                  {compactContent}
                </button>
              ) : (
                <article className={`${cardBase} ${cardSizing} flex items-center`}>{compactContent}</article>
              )
            ) : (
              <article className={`${cardBase} ${cardSizing}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center bg-[#0F0F0F] px-2.5 py-1 font-mono text-[11px] font-bold text-white landing-inner-radius">
                        #{scan.scanId}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold landing-inner-radius ${tone.chip}`}>
                        {getScanStatusLabel(scan.status)}
                      </span>
                      {showProjectChip && scan.projectId !== undefined ? (
                        <span className="inline-flex items-center border border-neutral-200 bg-white px-2.5 py-1 font-mono text-[11px] font-bold text-neutral-600 landing-inner-radius">
                          {scan.projectName ?? `프로젝트 #${scan.projectId}`}
                        </span>
                      ) : null}
                      <span className="text-[11px] text-neutral-500">
                        {getScanModeLabel(scan.scanMode, scan.source)}
                        {typeLabel ? <span className="mx-1 text-neutral-300">·</span> : null}
                        {typeLabel}
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-500">
                      요청: <span className="font-semibold text-neutral-700">{formatCompactDateTime(scan.requestedAt)}</span>
                      {scan.completedAt ? (
                        <>
                          <span className="mx-2 text-neutral-300">·</span>
                          완료: <span className="font-semibold text-neutral-700">{formatCompactDateTime(scan.completedAt)}</span>
                        </>
                      ) : null}
                    </p>

                    {scan.severity && scan.status === 'DONE' ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {totalSeverity === 0 ? (
                          <span className="rounded border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-bold text-neutral-400">
                            이슈 없음
                          </span>
                        ) : (
                          severityPillClasses.map((pill) => {
                            const count = scan.severity?.[pill.key] ?? 0;
                            if (count === 0) return null;
                            return (
                              <span
                                key={pill.key}
                                className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-bold ${pill.cls}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
                                {pill.label} {count}
                              </span>
                            );
                          })
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="inline-flex items-center gap-1 border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-700 transition landing-inner-radius hover:border-black hover:text-black"
                      state={linkState}
                      to={ROUTES.scanDetail.replace(':scanId', String(scan.scanId))}
                    >
                      진행 상태
                    </Link>
                    {scan.status === 'DONE' ? (
                      <Link
                        className="inline-flex items-center gap-1.5 bg-[#0F0F0F] px-3 py-1.5 text-xs font-bold text-white transition landing-inner-radius hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.18)]"
                        state={linkState}
                        to={ROUTES.resultDetail.replace(':scanId', String(scan.scanId))}
                      >
                        결과 보기
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : null}
                    {onDeleteScan && isDeleteAllowed ? (
                      <button
                        className="inline-flex items-center gap-1 border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-bold text-neutral-400 transition landing-inner-radius hover:border-rose-300 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isDeleting}
                        onClick={() => onDeleteScan(scan.scanId)}
                        type="button"
                      >
                        <Trash2 className="h-3 w-3" />
                        {isDeleting ? '삭제 중...' : '삭제'}
                      </button>
                    ) : onDeleteScan && deleteBlockedReason ? (
                      <span
                        className="inline-flex items-center border border-dashed border-neutral-200 px-2.5 py-1.5 text-[11px] text-neutral-400 landing-inner-radius"
                        title={deleteBlockedReason}
                      >
                        삭제 불가
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
}

export default ScanTimeline;
