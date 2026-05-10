import type { AgentStatus, AgentTaskStatus, ScanMode, ScanStatus, ScanType } from '../../../types/scan';

const scanStatusLabelMap: Record<ScanStatus, string> = {
  REQUESTED: '요청됨',
  QUEUED: '대기 중',
  RUNNING: '분석 중',
  RAW_UPLOADED: '원본 업로드 완료',
  DONE: '완료',
  FAILED: '실패',
  CANCELED: '취소됨',
};

const agentStatusLabelMap: Record<AgentStatus, string> = {
  ONLINE: '온라인',
  OFFLINE: '오프라인',
  ERROR: '오류',
};

const taskStatusLabelMap: Record<AgentTaskStatus, string> = {
  PENDING: '대기 중',
  SENT: '전송됨',
  ACKED: '수신 확인',
  RUNNING: '실행 중',
  DONE: '완료',
  FAILED: '실패',
  CANCELED: '취소됨',
};

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCompactDateTime(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatBooleanLabel(value: boolean) {
  return value ? '사용 중' : '사용 안 함';
}

export function getScanStatusLabel(status: ScanStatus) {
  return scanStatusLabelMap[status];
}

export function getAgentStatusLabel(status: AgentStatus) {
  return agentStatusLabelMap[status];
}

export function getTaskStatusLabel(status: AgentTaskStatus) {
  return taskStatusLabelMap[status];
}

export function getScanStatusClassName(status: ScanStatus) {
  switch (status) {
    case 'DONE':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'FAILED':
    case 'CANCELED':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'RAW_UPLOADED':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'RUNNING':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700';
    case 'QUEUED':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'REQUESTED':
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

export function getAgentStatusClassName(status: AgentStatus) {
  switch (status) {
    case 'ONLINE':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'ERROR':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'OFFLINE':
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

export function getTaskStatusClassName(status: AgentTaskStatus) {
  switch (status) {
    case 'RUNNING':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700';
    case 'ACKED':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'SENT':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'FAILED':
    case 'CANCELED':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'DONE':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'PENDING':
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

export function getScanModeLabel(scanMode: ScanMode) {
  if (scanMode === 'AGENT') {
    return '로컬 Agent 스캔';
  }

  if (scanMode === 'CLI') {
    return 'CLI 스캔';
  }

  return '파일 업로드 스캔';
}

export function getSafeScanType(scanType?: ScanType | null): ScanType {
  return scanType ?? 'PROJECT_SCAN';
}

export function getScanTypeLabel(scanType?: ScanType | null) {
  return getSafeScanType(scanType) === 'SERVER_AUDIT' ? '서버 점검' : '프로젝트 스캔';
}

export function isTerminalScanStatus(status: ScanStatus) {
  return status === 'DONE' || status === 'FAILED' || status === 'CANCELED';
}

export function canDeleteScanHistory(status: ScanStatus) {
  return status === 'REQUESTED' || status === 'DONE' || status === 'FAILED' || status === 'CANCELED';
}

export function getDeleteBlockedReason(status: ScanStatus) {
  if (canDeleteScanHistory(status)) {
    return null;
  }

  if (status === 'QUEUED' || status === 'RUNNING' || status === 'RAW_UPLOADED') {
    return '진행 중인 스캔은 삭제할 수 없습니다.';
  }

  return '현재 상태에서는 스캔을 삭제할 수 없습니다.';
}

export function getInternalAgentWebSocketUrl() {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL;

  if (envBaseUrl) {
    try {
      const url = new URL(envBaseUrl);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.pathname = '/ws/v1/internal/agents/connect';
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return '/ws/v1/internal/agents/connect';
    }
  }

  if (typeof window === 'undefined') {
    return '/ws/v1/internal/agents/connect';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/v1/internal/agents/connect`;
}
