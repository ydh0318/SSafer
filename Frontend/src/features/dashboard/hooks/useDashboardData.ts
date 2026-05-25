import { useEffect, useMemo, useState } from 'react';

import type { ProjectListItemData } from '../../../types/project';
import type {
  AgentStatusResponseData,
  FindingOpenSummaryData,
  ProjectScanListItemData,
  ScanStatus,
  ScanSummaryData,
} from '../../../types/scan';
import { getProjectAgentStatus } from '../../agents/api/agents';
import { getProjects } from '../../projects/api/projects';
import { getOpenFindingSummary, getScanSummary } from '../../results/api/results';
import { getProjectScans } from '../../scans/api/scans';
import { formatDateTime, isTerminalScanStatus } from '../../scans/utils/scanPresentation';

export type DashboardScan = ProjectScanListItemData & {
  projectId: number;
  projectName: string;
  summary: ScanSummaryData | null;
};

export type DashboardMonitorStatus = 'ONLINE' | 'OFFLINE' | 'ERROR' | 'UNKNOWN';

export type DashboardMonitorProject = {
  projectId: number;
  projectName: string;
  status: DashboardMonitorStatus;
  lastSeenAt: string | null;
};

type DashboardProjectScan = {
  project: ProjectListItemData;
  scan: DashboardScan;
  scans: DashboardScan[];
};

const searchableStatuses: ScanStatus[] = [
  'REQUESTED',
  'QUEUED',
  'RUNNING',
  'RAW_UPLOADED',
  'DONE',
  'FAILED',
  'CANCELED',
];

async function buildDashboardScans(projects: ProjectListItemData[]) {
  const scanLists = await Promise.all(
    projects.map(async (project) => {
      const scanData = await getProjectScans(String(project.projectId), { page: 0, size: 10 });

      return scanData.items.map((scan) => ({
        ...scan,
        projectId: project.projectId,
        projectName: project.name,
      }));
    }),
  );

  const mergedScans = scanLists
    .flat()
    .sort((left, right) => new Date(right.requestedAt).getTime() - new Date(left.requestedAt).getTime());

  const summaryEntries = await Promise.all(
    mergedScans
      .filter((scan) => scan.status === 'DONE')
      .map(async (scan) => {
        try {
          const summary = await getScanSummary(scan.scanId);
          return [scan.scanId, summary] as const;
        } catch {
          return [scan.scanId, null] as const;
        }
      }),
  );

  const summaryMap = new Map<number, ScanSummaryData | null>(summaryEntries);

  return mergedScans.map((scan) => ({
    ...scan,
    summary: summaryMap.get(scan.scanId) ?? null,
  }));
}

function buildDashboardMonitorProjects(
  projects: ProjectListItemData[],
  monitorStatuses: Array<{ projectId: number; status: DashboardMonitorStatus; lastSeenAt: string | null }>,
) {
  const monitorStatusMap = new Map(monitorStatuses.map((item) => [item.projectId, item]));

  return projects
    .filter((project) => project.monitorEnabled)
    .map<DashboardMonitorProject>((project) => {
      const status = monitorStatusMap.get(project.projectId);

      return {
        projectId: project.projectId,
        projectName: project.name,
        status: status?.status ?? 'UNKNOWN',
        lastSeenAt: status?.lastSeenAt ?? null,
      };
    });
}

export function getDashboardMonitorStatusLabel(status: DashboardMonitorStatus) {
  switch (status) {
    case 'ONLINE':
      return '연결됨';
    case 'OFFLINE':
      return '대기';
    case 'ERROR':
      return '오류';
    case 'UNKNOWN':
    default:
      return '상태 확인 중';
  }
}

export function getDashboardMonitorStatusClassName(status: DashboardMonitorStatus) {
  switch (status) {
    case 'ONLINE':
      return 'font-bold text-[#0A8F4E]';
    case 'ERROR':
      return 'font-bold text-[#E63946]';
    case 'OFFLINE':
    case 'UNKNOWN':
    default:
      return 'font-bold text-neutral-500';
  }
}

function normalizeDashboardErrorMessage(errorMessage: string | null) {
  if (!errorMessage) {
    return null;
  }

  if (errorMessage.includes('Authentication is required or token is invalid')) {
    return '로그인이 만료되어 대시보드 정보를 불러오지 못했습니다. 다시 로그인해 주세요.';
  }

  return errorMessage;
}

function useDashboardData(isGuestSession: boolean) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectListItemData[]>([]);
  const [scans, setScans] = useState<DashboardScan[]>([]);
  const [openSummary, setOpenSummary] = useState<FindingOpenSummaryData | null>(null);
  const [agentStatusMap, setAgentStatusMap] = useState<Record<number, AgentStatusResponseData | null>>({});
  const [isAgentStatusLoaded, setIsAgentStatusLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ScanStatus>('ALL');

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [projectData, nextOpenSummary] = await Promise.all([
          getProjects({ page: 0, size: 20 }),
          getOpenFindingSummary(),
        ]);
        const nextProjects = projectData.items;
        const nextScans = await buildDashboardScans(nextProjects);

        if (!isMounted) {
          return;
        }

        setProjects(nextProjects);
        setScans(nextScans);
        setOpenSummary(nextOpenSummary);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error('Failed to load dashboard data.', error);
        setErrorMessage(error instanceof Error ? error.message : '대시보드 정보를 불러오지 못했습니다.');
        setProjects([]);
        setScans([]);
        setOpenSummary(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const dashboardProjectScans = useMemo<DashboardProjectScan[]>(
    () =>
      projects
        .map((project) => {
          const projectScans = scans.filter((scan) => scan.projectId === project.projectId);
          const representativeScan =
            projectScans.find((scan) => !isTerminalScanStatus(scan.status)) ?? projectScans[0] ?? null;

          if (!representativeScan) {
            return null;
          }

          return {
            project,
            scan: representativeScan,
            scans: projectScans,
          };
        })
        .filter((item): item is DashboardProjectScan => item !== null)
        .sort((left, right) => new Date(right.scan.requestedAt).getTime() - new Date(left.scan.requestedAt).getTime()),
    [projects, scans],
  );

  const filteredProjectScans = useMemo(
    () =>
      dashboardProjectScans.filter(({ project, scan, scans: projectScans }) => {
        const query = searchTerm.trim().toLowerCase();
        const matchesSearch =
          query.length === 0 ||
          project.name.toLowerCase().includes(query) ||
          projectScans.some((projectScan) => String(projectScan.scanId).includes(query));
        const matchesStatus = statusFilter === 'ALL' || scan.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [dashboardProjectScans, searchTerm, statusFilter],
  );

  const latestDoneScansByProject = useMemo(
    () =>
      dashboardProjectScans
        .map(({ scans: projectScans }) => projectScans.find((scan) => scan.status === 'DONE') ?? null)
        .filter((scan): scan is DashboardScan => scan !== null),
    [dashboardProjectScans],
  );

  const totals = useMemo(
    () => ({
      critical: openSummary?.bySeverity.CRITICAL ?? 0,
      high: openSummary?.bySeverity.HIGH ?? 0,
      medium: openSummary?.bySeverity.MEDIUM ?? 0,
      low: openSummary?.bySeverity.LOW ?? 0,
      info: openSummary?.bySeverity.INFO ?? 0,
    }),
    [openSummary],
  );

  const unresolvedCount = openSummary?.openCount ?? 0;
  const recentDoneScan = useMemo(() => latestDoneScansByProject[0] ?? null, [latestDoneScansByProject]);
  const highlightedScan = useMemo(
    () => latestDoneScansByProject.find((scan) => (scan.summary?.criticalCount ?? 0) > 0) ?? recentDoneScan,
    [latestDoneScansByProject, recentDoneScan],
  );

  const monitoredProjectKey = useMemo(
    () => projects.filter((project) => project.monitorEnabled).map((project) => project.projectId).join(','),
    [projects],
  );

  useEffect(() => {
    const monitored = projects.filter((project) => project.monitorEnabled);
    if (monitored.length === 0) {
      return;
    }

    let isMounted = true;

    void (async () => {
      const entries = await Promise.all(
        monitored.map(async (project) => {
          const status = await getProjectAgentStatus(String(project.projectId)).catch(() => null);
          return [project.projectId, status] as const;
        }),
      );

      if (isMounted) {
        setAgentStatusMap(Object.fromEntries(entries));
        setIsAgentStatusLoaded(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [monitoredProjectKey, projects]);

  const activeAgentStatusMap = useMemo(
    () => (monitoredProjectKey ? agentStatusMap : {}),
    [agentStatusMap, monitoredProjectKey],
  );
  const activeIsAgentStatusLoaded = monitoredProjectKey ? isAgentStatusLoaded : true;

  const monitorProjects = useMemo(() => {
    const monitorStatuses = projects
      .filter((project) => project.monitorEnabled)
      .map((project) => {
        const agentStatus = activeAgentStatusMap[project.projectId] ?? null;
        let status: DashboardMonitorStatus;

        if (!activeIsAgentStatusLoaded) {
          status = 'UNKNOWN';
        } else if (agentStatus?.status === 'ONLINE') {
          status = 'ONLINE';
        } else if (agentStatus?.status === 'ERROR') {
          status = 'ERROR';
        } else {
          status = 'OFFLINE';
        }

        return {
          projectId: project.projectId,
          status,
          lastSeenAt: agentStatus?.lastSeenAt ?? null,
        };
      });

    return buildDashboardMonitorProjects(projects, monitorStatuses);
  }, [projects, activeAgentStatusMap, activeIsAgentStatusLoaded]);

  const timelineItems = useMemo(
    () =>
      filteredProjectScans.slice(0, 8).map(({ scan }) => ({
        scanId: scan.scanId,
        status: scan.status,
        scanMode: scan.scanMode,
        scanType: scan.scanType,
        source: scan.source,
        requestedAt: scan.requestedAt,
        completedAt: scan.completedAt,
        projectId: scan.projectId,
        severity: scan.summary
          ? {
              critical: scan.summary.criticalCount,
              high: scan.summary.highCount,
              medium: scan.summary.mediumCount,
              low: scan.summary.lowCount,
            }
          : undefined,
      })),
    [filteredProjectScans],
  );

  const guestBanner = isGuestSession
    ? {
        title: '게스트 모드에서는 스캔 결과와 이력이 세션 종료 후 저장되지 않습니다.',
        description:
          '로그인하면 프로젝트별 스캔 이력을 계속 보관하고, 이후에도 다시 확인할 수 있습니다.',
      }
    : null;

  return {
    displayErrorMessage: normalizeDashboardErrorMessage(errorMessage),
    filteredProjectScans,
    guestBanner,
    highlightedScan,
    isLoading,
    monitorProjects,
    recentDoneScan,
    searchTerm,
    searchableStatuses,
    setSearchTerm,
    setStatusFilter,
    statusFilter,
    timelineItems,
    totals,
    unresolvedCount,
  };
}

export function getDashboardMonitorLastSeenText(project: DashboardMonitorProject) {
  if (project.lastSeenAt) {
    return `최근 확인 ${formatDateTime(project.lastSeenAt)}`;
  }

  if (project.status === 'UNKNOWN') {
    return '연결 상태를 확인하고 있습니다.';
  }

  return '아직 에이전트가 연결된 적이 없습니다.';
}

export default useDashboardData;
