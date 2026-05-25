import { motion } from 'framer-motion';
import { RefreshCw, Trash2 } from 'lucide-react';

import type { ProjectDetailResponseData } from '../../../types/project';
import type { AgentStatusResponseData } from '../../../types/scan';
import { formatCompactDateTime, getScanModeLabel } from '../../scans/utils/scanPresentation';

type ProjectSettingsPanelProps = {
  project: (ProjectDetailResponseData & { createdAt?: string | null }) | null;
  agentStatus: AgentStatusResponseData | null;
  isAgentLoading: boolean;
  agentErrorMessage: string | null;
  scanCount: number;
  onRefreshAgent: () => void;
  onDeleteProject: () => void;
};

function ProjectSettingsPanel({
  project,
  agentStatus,
  isAgentLoading,
  agentErrorMessage,
  scanCount,
  onRefreshAgent,
  onDeleteProject,
}: ProjectSettingsPanelProps) {
  return (
    <div className="space-y-4 landing-anim">
      <div className="grid gap-4 md:grid-cols-2">
        <Card delay={0} emoji="📚" subtitle="기본 설정과 프로젝트 메타데이터입니다." title="프로젝트 정보">
          <Row label="프로젝트 이름" value={project?.name ?? '-'} />
          {project?.createdAt ? <Row label="생성일" value={formatCompactDateTime(project.createdAt) ?? '-'} /> : null}
          <Row label="전체 스캔" value={`${scanCount}건`} />
          <Row label="기본 스캔 방식" value={project ? getScanModeLabel(project.defaultScanMode) : '-'} />
        </Card>

        <Card
          action={
            <button
              aria-label="에이전트 상태 새로고침"
              className="inline-flex items-center gap-1 border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-bold text-neutral-600 transition landing-inner-radius hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isAgentLoading}
              onClick={onRefreshAgent}
              type="button"
            >
              <RefreshCw className={`h-3 w-3 ${isAgentLoading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
          }
          delay={0.05}
          emoji="🛰"
          subtitle="연결된 로컬 에이전트 정보입니다."
          title="에이전트 상태"
        >
          {agentErrorMessage ? (
            <p className="border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 landing-inner-radius">
              {agentErrorMessage}
            </p>
          ) : null}
          <Row
            label="상태"
            value={
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    agentStatus?.status === 'ONLINE'
                      ? 'bg-[#7CB300]'
                      : agentStatus?.status === 'ERROR'
                        ? 'bg-rose-500'
                        : 'bg-neutral-400'
                  }`}
                />
                {agentStatus?.status === 'ONLINE'
                  ? '온라인'
                  : agentStatus?.status === 'OFFLINE'
                    ? '오프라인'
                    : agentStatus?.status === 'ERROR'
                      ? '오류'
                      : '미연결'}
              </span>
            }
          />
          <Row label="Agent ID" value={agentStatus ? `Agent #${agentStatus.agentId}` : '-'} />
          <Row label="연결 시각" value={formatCompactDateTime(agentStatus?.connectedAt) ?? '-'} />
          <Row label="마지막 확인" value={formatCompactDateTime(agentStatus?.lastSeenAt) ?? '-'} />
          <Row label="현재 작업" value={agentStatus?.currentTaskType ? formatTaskType(agentStatus.currentTaskType) : '없음'} />
        </Card>

        <Card delay={0.1} emoji="🔏" subtitle="업로드 중 민감정보는 자동으로 마스킹됩니다." title="마스킹 정책">
          <MaskingRow label="password / passwd / pwd" />
          <MaskingRow label="api_key / token / secret" />
          <MaskingRow label="private key 블록" />
          <MaskingRow label="AWS access key" />
        </Card>

        <DangerCard delay={0.15} onDelete={onDeleteProject} projectName={project?.name ?? ''} />
      </div>
    </div>
  );
}

function formatTaskType(type: string) {
  if (type === 'SCAN_REQUEST') {
    return '스캔 요청';
  }
  if (type === 'PATCH_APPLY') {
    return '패치 적용';
  }
  return type;
}

type CardProps = {
  emoji: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  delay?: number;
  action?: React.ReactNode;
};

function Card({ emoji, title, subtitle, children, delay = 0, action }: CardProps) {
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 border border-neutral-200/60 bg-white/20 p-7 backdrop-blur-sm landing-card-radius"
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-black tracking-tight text-[#0F0F0F]">
            <span aria-hidden className="text-lg leading-none">
              {emoji}
            </span>
            {title}
          </h3>
          <p className="mt-1.5 text-xs text-neutral-500">{subtitle}</p>
        </div>
        {action ?? null}
      </header>
      <dl className="space-y-3 text-sm">{children}</dl>
    </motion.section>
  );
}

function Row({
  label,
  value,
  valueClass = 'text-[#0F0F0F]',
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className={`text-sm font-bold ${valueClass}`}>{value}</dd>
    </div>
  );
}

function MaskingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="font-mono text-xs text-neutral-700">{label}</dt>
      <dd className="text-xs font-bold text-[#4A7A00]">적용</dd>
    </div>
  );
}

function DangerCard({
  projectName,
  onDelete,
  delay = 0,
}: {
  projectName: string;
  onDelete: () => void;
  delay?: number;
}) {
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 border border-rose-200/60 bg-rose-50/30 p-7 backdrop-blur-sm landing-card-radius"
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <header>
        <h3 className="flex items-center gap-2 text-base font-black tracking-tight text-rose-900">
          <span aria-hidden className="text-lg leading-none">
            ⚠
          </span>
          프로젝트 삭제
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-rose-700/80">
          삭제하면 이 프로젝트의 모든 스캔 이력과 분석 결과를 되돌릴 수 없습니다.
        </p>
      </header>
      <dl className="space-y-3 text-sm">
        <Row label="프로젝트 이름" value={projectName || '-'} valueClass="text-rose-900" />
        <Row label="영향 범위" value="모든 스캔 | 결과 | 패치" valueClass="text-rose-900" />
      </dl>
      <button
        className="inline-flex w-full items-center justify-center gap-2 border border-rose-300 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 transition landing-inner-radius hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!projectName}
        onClick={onDelete}
        type="button"
      >
        <Trash2 className="h-4 w-4" />
        프로젝트 삭제하기
      </button>
    </motion.section>
  );
}

export default ProjectSettingsPanel;
