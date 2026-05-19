import { ArrowRightLeft, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PageBanner from '../../components/common/PageBanner';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import { hasStoredMemberSession, isStoredGuestSession } from '../../features/auth/utils/session';
import { useToast } from '../../features/feedback/useToast';
import { getHistoryScans } from '../../features/history/api/history';
import { getProjects } from '../../features/projects/api/projects';
import { getScanCompare } from '../../features/results/api/results';
import { deleteScanHistory } from '../../features/scans/api/scans';
import ScanTimeline from '../../features/scans/components/ScanTimeline';
import { useScanEventSubscription } from '../../features/scans/hooks/useScanEventSubscription';
import { getSafeScanType } from '../../features/scans/utils/scanPresentation';
import { useAuthStore } from '../../store/authStore';
import { useProjectStore } from '../../store/projectStore';
import type {
  HistoryScanListResponseData,
  ScanCompareFindingData,
  ScanCompareResponseData,
  ScanMode,
} from '../../types/scan';

const HISTORY_PAGE_SIZE = 10;

type HistoryFilters = {
  scanMode?: ScanMode | '';
  status?: 'DONE' | 'FAILED' | '';
  projectId?: string;
};

const emptyHistoryData: HistoryScanListResponseData = {
  summary: {
    totalScanCount: 0,
    totalFindingCount: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    infoCount: 0,
  },
  items: [],
  page: 0,
  size: HISTORY_PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
};

function CompareFindingList({ items, emptyMessage }: { items: ScanCompareFindingData[]; emptyMessage: string }) {
  if (items.length === 0) {
    return (
      <div className="border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-sm text-neutral-400 landing-inner-radius">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <article className="border border-neutral-100 bg-white p-4 landing-inner-radius" key={`${item.scanId}-${item.findingId}-${item.comparisonKey}`}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-neutral-400">#{item.findingId}</span>
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-600">{item.severity}</span>
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-600">{item.sourceType}</span>
            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-600">{item.category}</span>
          </div>
          <h4 className="mt-2 text-sm font-bold text-black">{item.title}</h4>
          <div className="mt-1 font-mono text-[11px] text-neutral-400">
            스캔 #{item.scanId}
            {item.ruleCode ? ` · ${item.ruleCode}` : ''}
            {item.filePath ? ` · ${item.filePath}` : ' · 파일 경로 없음'}
            {item.lineNumber ? ` : ${item.lineNumber}` : ''}
          </div>
        </article>
      ))}
    </div>
  );
}

function HistoryPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const user = useAuthStore((state) => state.user);
  const storedProjects = useProjectStore((state) => state.projects);
  const toast = useToast();

  const isGuestSession = user?.role === 'GUEST' || isStoredGuestSession();
  const hasMemberSession =
    Boolean(refreshToken) || user?.role === 'USER' || user?.role === 'ADMIN' || hasStoredMemberSession();
  const canAccessHistory = isAuthenticated && hasMemberSession && !isGuestSession;

  const [filterScanMode, setFilterScanMode] = useState<ScanMode | ''>('');
  const [filterStatus, setFilterStatus] = useState<'DONE' | 'FAILED' | ''>('');
  const [filterProjectId, setFilterProjectId] = useState('');

  const [historyData, setHistoryData] = useState<HistoryScanListResponseData>(emptyHistoryData);
  const [projectNameMap, setProjectNameMap] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [selectedBaseScanId, setSelectedBaseScanId] = useState('');
  const [selectedTargetScanId, setSelectedTargetScanId] = useState('');
  const [compareData, setCompareData] = useState<ScanCompareResponseData | null>(null);
  const [isCompareLoading, setIsCompareLoading] = useState(false);
  const [deletingScanIds, setDeletingScanIds] = useState<number[]>([]);

  const visibleHistoryItems = useMemo(
    () =>
      filterProjectId
        ? historyData.items.filter((item) => String(item.projectId) === filterProjectId)
        : historyData.items,
    [filterProjectId, historyData.items],
  );

  const doneHistoryItems = useMemo(
    () => visibleHistoryItems.filter((item) => item.status === 'DONE' && getSafeScanType(item.scanType) === 'PROJECT_FILE'),
    [visibleHistoryItems],
  );

  const selectedBaseScan = useMemo(
    () => doneHistoryItems.find((item) => String(item.scanId) === selectedBaseScanId) ?? null,
    [doneHistoryItems, selectedBaseScanId],
  );

  const comparableTargetItems = useMemo(
    () =>
      selectedBaseScan
        ? doneHistoryItems.filter(
            (item) => item.projectId === selectedBaseScan.projectId && String(item.scanId) !== selectedBaseScanId,
          )
        : [],
    [doneHistoryItems, selectedBaseScan, selectedBaseScanId],
  );

  const compareGuideMessage = useMemo(() => {
    if (visibleHistoryItems.length === 0) {
      return '현재 조건에 해당하는 스캔 이력이 없습니다.';
    }

    if (doneHistoryItems.length === 0) {
      return '비교 가능한 프로젝트 파일 스캔이 없습니다.';
    }

    if (!selectedBaseScan) {
      return '기준 스캔을 먼저 선택하세요.';
    }

    if (comparableTargetItems.length === 0) {
      return '선택한 기준 스캔과 같은 프로젝트의 다른 완료 스캔이 없습니다.';
    }

    return '서버 점검 결과는 비교 대상에서 제외됩니다.';
  }, [comparableTargetItems.length, doneHistoryItems.length, selectedBaseScan, visibleHistoryItems.length]);

  const projectFilterOptions = useMemo(
    () => {
      const projects = new Map<number, string>();

      Object.entries(projectNameMap).forEach(([projectId, projectName]) => {
        const numericProjectId = Number(projectId);
        if (Number.isFinite(numericProjectId)) {
          projects.set(numericProjectId, projectName);
        }
      });

      historyData.items.forEach((item) => {
        projects.set(item.projectId, projectNameMap[item.projectId] ?? `프로젝트 ${item.projectId}`);
      });

      const nameCounts = Array.from(projects.values()).reduce<Record<string, number>>((accumulator, projectName) => {
        accumulator[projectName] = (accumulator[projectName] ?? 0) + 1;
        return accumulator;
      }, {});

      return Array.from(projects.entries())
        .map(([projectId, projectName]) => ({
          projectId: String(projectId),
          projectName: nameCounts[projectName] > 1 ? `${projectName} (#${projectId})` : projectName,
        }))
        .sort((left, right) => left.projectName.localeCompare(right.projectName));
    },
    [historyData.items, projectNameMap],
  );

  const formatScanOptionLabel = (item: { scanId: number; projectId: number }) => {
    return `${projectNameMap[item.projectId] ?? `프로젝트 ${item.projectId}`} / #${item.scanId}`;
  };

  const getCompareFailureMessage = (error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes('not found') || normalizedMessage.includes('404')) {
      return '비교 생성에 실패했습니다. 선택한 스캔을 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 선택해 주세요.';
    }

    if (normalizedMessage.includes('unauthorized') || normalizedMessage.includes('forbidden') || normalizedMessage.includes('401') || normalizedMessage.includes('403')) {
      return '비교 생성에 실패했습니다. 접근 권한을 확인한 뒤 다시 시도해 주세요.';
    }

    if (normalizedMessage.includes('internal server error') || normalizedMessage.includes('500')) {
      return '비교 생성에 실패했습니다. 서버에서 비교 결과를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }

    return '비교 생성에 실패했습니다. 완료된 프로젝트 파일 스캔 2개를 선택했는지 확인해 주세요.';
  };

  const toHistoryProjectId = (projectId?: string) => {
    if (!projectId) return undefined;
    const parsedProjectId = Number(projectId);
    return Number.isFinite(parsedProjectId) ? parsedProjectId : undefined;
  };

  const loadHistory = async (params?: HistoryFilters) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const projectId = toHistoryProjectId(params?.projectId);
      const data = await getHistoryScans({
        page: 0,
        size: HISTORY_PAGE_SIZE,
        ...(params?.scanMode && { scanMode: params.scanMode }),
        ...(params?.status && { status: params.status }),
        ...(typeof projectId === 'number' && { projectId }),
      });
      setHistoryData(data);
      return data;
    } catch (error) {
      setHistoryData(emptyHistoryData);
      setErrorMessage(error instanceof Error ? error.message : '히스토리를 불러오지 못했습니다.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccessHistory) {
      setProjectNameMap({});
      return;
    }

    if (storedProjects.length > 0) {
      setProjectNameMap((current) => ({
        ...current,
        ...storedProjects.reduce<Record<number, string>>((accumulator, project) => {
          accumulator[Number(project.id)] = project.name;
          return accumulator;
        }, {}),
      }));
    }
  }, [canAccessHistory, storedProjects]);

  useEffect(() => {
    if (!canAccessHistory) {
      return;
    }

    let isMounted = true;

    const loadProjectOptions = async () => {
      const pageSize = 100;
      const firstPage = await getProjects({ page: 0, size: pageSize });
      const allProjects = [...firstPage.items];

      for (let page = 1; page < firstPage.totalPages; page += 1) {
        const pageData = await getProjects({ page, size: pageSize });
        allProjects.push(...pageData.items);
      }

      return allProjects;
    };

    void loadProjectOptions()
      .then((projects) => {
        if (!isMounted) return;
        setProjectNameMap((current) => ({
          ...current,
          ...projects.reduce<Record<number, string>>((accumulator, project) => {
            accumulator[Number(project.id)] = project.name;
            return accumulator;
          }, {}),
        }));
      })
      .catch(() => {
        if (isMounted && storedProjects.length === 0) setProjectNameMap({});
      });

    return () => {
      isMounted = false;
    };
  }, [canAccessHistory, storedProjects.length]);

  useEffect(() => {
    if (!canAccessHistory) {
      setHistoryData(emptyHistoryData);
      setErrorMessage(null);
      setNoticeMessage(null);
      setCompareData(null);
      setSelectedBaseScanId('');
      setSelectedTargetScanId('');
      return;
    }

    let isMounted = true;

    const initializeHistory = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await getHistoryScans({ page: 0, size: HISTORY_PAGE_SIZE });

        if (!isMounted) return;
        setHistoryData(data);
      } catch (error) {
        if (!isMounted) return;
        setHistoryData(emptyHistoryData);
        setErrorMessage(error instanceof Error ? error.message : '히스토리를 불러오지 못했습니다.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void initializeHistory();
    return () => { isMounted = false; };
  }, [canAccessHistory]);

  useEffect(() => {
    const comparableBaseScanIds = new Set(
      doneHistoryItems
        .filter((item) => doneHistoryItems.some((other) => other.projectId === item.projectId && other.scanId !== item.scanId))
        .map((item) => String(item.scanId)),
    );
    const availableBaseIds = doneHistoryItems.map((item) => String(item.scanId));

    if (availableBaseIds.length < 2 || comparableBaseScanIds.size === 0) {
      if (selectedBaseScanId !== '') setSelectedBaseScanId('');
      if (selectedTargetScanId !== '') setSelectedTargetScanId('');
      setCompareData(null);
      return;
    }

    const nextBaseScanId =
      selectedBaseScanId && comparableBaseScanIds.has(selectedBaseScanId)
        ? selectedBaseScanId
        : (availableBaseIds.find((scanId) => comparableBaseScanIds.has(scanId)) ?? '');
    const nextBaseScan = doneHistoryItems.find((item) => String(item.scanId) === nextBaseScanId);
    const availableTargetIds = nextBaseScan
      ? doneHistoryItems
          .filter((item) => item.projectId === nextBaseScan.projectId && String(item.scanId) !== nextBaseScanId)
          .map((item) => String(item.scanId))
      : [];
    const nextTargetScanId =
      availableTargetIds.includes(selectedTargetScanId)
        ? selectedTargetScanId
        : (availableTargetIds[0] ?? '');

    if (nextBaseScanId !== selectedBaseScanId) setSelectedBaseScanId(nextBaseScanId);
    if (nextTargetScanId !== selectedTargetScanId) setSelectedTargetScanId(nextTargetScanId);
  }, [doneHistoryItems, selectedBaseScanId, selectedTargetScanId]);

  useEffect(() => {
    setCompareData(null);
  }, [selectedBaseScanId, selectedTargetScanId]);

  const handleFilterChange = (scanMode: ScanMode | '', status: 'DONE' | 'FAILED' | '', projectId = filterProjectId) => {
    setFilterScanMode(scanMode);
    setFilterStatus(status);
    setFilterProjectId(projectId);
    void loadHistory({ scanMode, status, projectId });
  };

  const handleRefresh = async () => {
    if (!canAccessHistory) return;
    setNoticeMessage(null);
    await loadHistory({ scanMode: filterScanMode, status: filterStatus, projectId: filterProjectId });
  };

  useScanEventSubscription(
    () => { if (canAccessHistory) void handleRefresh(); },
    () => { if (canAccessHistory) void handleRefresh(); },
  );

  const handleDeleteScan = async (scanId: number) => {
    const shouldDelete = window.confirm(`스캔 #${scanId} 이력을 삭제하시겠습니까?`);
    if (!shouldDelete) return;

    setDeletingScanIds((current) => [...current, scanId]);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      await deleteScanHistory(scanId);
      setNoticeMessage(`스캔 #${scanId} 이력이 삭제되었습니다.`);
      await loadHistory({ scanMode: filterScanMode, status: filterStatus, projectId: filterProjectId });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '스캔 이력을 삭제하지 못했습니다.');
      setNoticeMessage(null);
    } finally {
      setDeletingScanIds((current) => current.filter((value) => value !== scanId));
    }
  };

  const handleCompare = async () => {
    if (!selectedBaseScanId || !selectedTargetScanId) {
      toast.warning('비교할 완료된 프로젝트 파일 스캔 2개를 선택해 주세요.', { durationMs: 2500 });
      setCompareData(null);
      return;
    }

    if (selectedBaseScanId === selectedTargetScanId) {
      toast.warning('기준 스캔과 비교 스캔은 서로 달라야 합니다.', { durationMs: 2500 });
      setCompareData(null);
      return;
    }

    const baseScan = doneHistoryItems.find((item) => String(item.scanId) === selectedBaseScanId);
    const targetScan = doneHistoryItems.find((item) => String(item.scanId) === selectedTargetScanId);

    if (!baseScan || !targetScan || baseScan.projectId !== targetScan.projectId) {
      toast.warning('같은 프로젝트에서 완료된 프로젝트 파일 스캔끼리만 비교할 수 있습니다.', { durationMs: 2500 });
      setCompareData(null);
      return;
    }

    setIsCompareLoading(true);

    try {
      const data = await getScanCompare(selectedBaseScanId, selectedTargetScanId);
      setCompareData(data);
    } catch (error) {
      setCompareData(null);
      console.error('Failed to compare scans.', error);
      toast.error(getCompareFailureMessage(error), { durationMs: 3500 });
    } finally {
      setIsCompareLoading(false);
    }
  };

  const displayErrorMessage = errorMessage
    ? errorMessage.toLowerCase().includes('authentication') || errorMessage.includes('token is invalid')
      ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
      : errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch')
      ? '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      : errorMessage.includes('히스토리를 불러오지 못했습니다') || errorMessage.includes('불러오지 못했습니다')
      ? '히스토리 정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.'
      : errorMessage
    : null;

  return (
    <section className="space-y-8">
      {/* ── 히어로 ── */}
      <section className="border-b border-neutral-200 pb-12">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="font-mono text-xs tracking-[0.32em] text-neutral-500 uppercase">History</p>
            <p className="mt-1 text-lg text-neutral-700">누적 스캔 수</p>
            <div className="mt-6 flex flex-wrap items-end gap-6">
              <div className="bg-[#D4FC64] px-8 py-4 text-black landing-inner-radius">
                <span className="text-8xl font-black leading-none tabular-nums md:text-[10rem]">
                  {historyData.summary.totalScanCount}
                </span>
              </div>
              <div className="pb-2">
                <div className="text-4xl font-black text-neutral-400">건</div>
                <div className="mt-5 font-mono text-xs tracking-[0.32em] text-neutral-500">SCAN HISTORY</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 xl:items-end">
            <PixelGoose mood={historyData.summary.criticalCount > 0 ? 'alert' : 'working'} size={116} />
            <div className="flex flex-col text-left text-sm leading-7 text-neutral-500 xl:items-end xl:text-right">
              <span className="w-fit">지난 스캔 이력을 확인하고</span>
              <span className="w-fit">완료된 스캔끼리 비교해 변화 흐름을 확인할 수 있습니다.</span>
            </div>
            {canAccessHistory && (
              <button
                className="inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700 transition landing-inner-radius hover:border-black hover:text-black"
                onClick={() => void handleRefresh()}
                type="button"
              >
                <RefreshCw className="h-4 w-4" />
                새로고침
              </button>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-neutral-200 pt-8">
          {[
            { label: '전체 누적 탐지 수', value: historyData.summary.totalFindingCount, color: '#111111' },
            { label: 'Critical',   value: historyData.summary.criticalCount,      color: '#E63946' },
            { label: 'High',       value: historyData.summary.highCount,          color: '#FF8A33' },
            { label: 'Medium',     value: historyData.summary.mediumCount,        color: '#FFB627' },
            { label: 'Low',        value: historyData.summary.lowCount,           color: '#3D5AFE' },
            { label: 'Info',       value: historyData.summary.infoCount,          color: '#9CA3AF' },
          ].map((stat) => (
            <div className="flex items-baseline gap-3" key={stat.label}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: stat.color }} />
              <span className="text-4xl font-black tabular-nums">
                {stat.value}
              </span>
              <span className="text-sm text-neutral-500">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {!canAccessHistory ? (
        <div className="border border-dashed border-neutral-300 bg-white p-10 landing-card-radius">
          <h2 className="text-3xl font-black tracking-tight text-black">회원 로그인이 필요합니다</h2>
          <div className="mt-5">
            <button
              className="inline-flex items-center gap-2 bg-black px-5 py-3 text-sm font-bold text-white transition landing-inner-radius hover:bg-neutral-800"
              onClick={() => {
                logout();
                navigate(ROUTES.login);
              }}
              type="button"
            >
              로그인하러 가기
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {displayErrorMessage ? <PageBanner message={displayErrorMessage} tone="error" /> : noticeMessage ? <PageBanner message={noticeMessage} tone="success" /> : null}

          {/* ── 스캔 비교 ── */}
          <div className="border border-neutral-100 bg-white px-6 py-6 landing-card-radius">
            <div className="flex flex-col gap-4 border-b border-neutral-100 pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">결과 비교</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-black">스캔 비교</h2>
                <p className="mt-2 text-sm leading-7 text-neutral-500">
                  같은 프로젝트의 완료된 프로젝트 파일 스캔 2개를 비교합니다.
                </p>
                <p className="mt-2 max-w-xl rounded-full bg-neutral-50 px-3 py-1.5 text-xs font-bold text-neutral-500">
                  {compareGuideMessage}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,220px)_auto]">
                <label className="space-y-1.5">
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-400">기준 스캔</span>
                  <select
                    className="w-full border border-neutral-200 bg-white px-3 py-2.5 text-sm text-black outline-none transition landing-inner-radius focus:border-black"
                    disabled={doneHistoryItems.length === 0}
                    onChange={(event) => setSelectedBaseScanId(event.target.value)}
                    value={selectedBaseScanId}
                  >
                    <option value="">{doneHistoryItems.length === 0 ? '선택 없음' : '스캔 선택'}</option>
                    {doneHistoryItems.map((item) => (
                      <option key={`base-${item.scanId}`} value={item.scanId}>
                        {formatScanOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-400">비교 스캔</span>
                  <select
                    className="w-full border border-neutral-200 bg-white px-3 py-2.5 text-sm text-black outline-none transition landing-inner-radius focus:border-black"
                    disabled={!selectedBaseScan || comparableTargetItems.length === 0}
                    onChange={(event) => setSelectedTargetScanId(event.target.value)}
                    value={selectedTargetScanId}
                  >
                    <option value="">
                      {!selectedBaseScan
                        ? '기준 선택'
                        : comparableTargetItems.length === 0
                          ? '선택 없음'
                          : '스캔 선택'}
                    </option>
                    {comparableTargetItems.map((item) => (
                      <option
                        disabled={String(item.scanId) === selectedBaseScanId}
                        key={`target-${item.scanId}`}
                        value={item.scanId}
                      >
                        {formatScanOptionLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="mt-auto inline-flex items-center justify-center gap-2 bg-black px-4 py-2.5 text-sm font-bold text-white transition landing-inner-radius hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
                  disabled={
                    isCompareLoading ||
                    doneHistoryItems.length < 2 ||
                    comparableTargetItems.length < 1 ||
                    selectedBaseScanId === '' ||
                    selectedTargetScanId === '' ||
                    selectedBaseScanId === selectedTargetScanId
                  }
                  onClick={() => void handleCompare()}
                  type="button"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  {isCompareLoading ? '비교 중...' : '비교하기'}
                </button>
              </div>
            </div>

            {compareData ? (
              <div className="mt-6 space-y-6">
                {/* 비교 요약 숫자 */}
                <div className="flex flex-wrap items-center gap-x-10 gap-y-4 border-b border-neutral-100 pb-6">
                  {[
                    { label: '신규',      value: compareData.summary.newCount,             color: '#E63946' },
                    { label: '해결됨',    value: compareData.summary.resolvedCount,         color: '#9FCC2E' },
                    { label: '유지됨',    value: compareData.summary.retainedCount,         color: '#9CA3AF' },
                    { label: '심각도 변경', value: compareData.summary.severityChangedCount, color: '#FF8A33' },
                  ].map((stat) => (
                    <div className="flex items-baseline gap-3" key={stat.label}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: stat.color }} />
                      <span className="text-3xl font-black tabular-nums">{stat.value}</span>
                      <span className="text-sm text-neutral-500">{stat.label}</span>
                    </div>
                  ))}
                  <div className="ml-auto flex items-center gap-6 font-mono text-xs text-neutral-400">
                    <span>기준 <span className="font-bold text-black">#{compareData.baseScanId}</span></span>
                    <span>→</span>
                    <span>비교 <span className="font-bold text-black">#{compareData.targetScanId}</span></span>
                    <span className="text-neutral-300">·</span>
                    <span>{compareData.summary.baseFindingCount} → {compareData.summary.targetFindingCount}건</span>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">신규 취약점</p>
                    <CompareFindingList emptyMessage="새롭게 추가된 취약점이 없습니다." items={compareData.newFindings} />
                  </div>
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">해결된 취약점</p>
                    <CompareFindingList emptyMessage="해결된 취약점이 없습니다." items={compareData.resolvedFindings} />
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">유지된 취약점</p>
                    <CompareFindingList emptyMessage="계속 유지된 취약점이 없습니다." items={compareData.retainedFindings} />
                  </div>
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400">심각도 변경</p>
                    {compareData.severityChangedFindings.length === 0 ? (
                      <div className="border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-sm text-neutral-400 landing-inner-radius">
                        심각도가 변경된 취약점이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {compareData.severityChangedFindings.map((item) => (
                          <article
                            className="border border-neutral-100 bg-white p-4 landing-inner-radius"
                            key={`${item.baseFinding.findingId}-${item.targetFinding.findingId}`}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-neutral-400">#{item.targetFinding.findingId}</span>
                              <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-600">
                                {item.baseSeverity} → {item.targetSeverity}
                              </span>
                            </div>
                            <h4 className="mt-2 text-sm font-bold text-black">{item.targetFinding.title}</h4>
                            <div className="mt-1 font-mono text-[11px] text-neutral-400">
                              기준 #{item.baseFinding.scanId} · 비교 #{item.targetFinding.scanId}
                              {item.targetFinding.ruleCode ? ` · ${item.targetFinding.ruleCode}` : ''}
                              {item.targetFinding.filePath ? ` · ${item.targetFinding.filePath}` : ''}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* ── 이력 목록 ── */}
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-black tracking-tight md:text-2xl">스캔 이력</h2>
              <div className="flex flex-wrap items-center gap-4">
                {/* 프로젝트 */}
                <label className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">프로젝트</span>
                  <select
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-600 outline-none transition hover:border-neutral-400 focus:border-black"
                    onChange={(event) => handleFilterChange(filterScanMode, filterStatus, event.target.value)}
                    value={filterProjectId}
                  >
                    <option value="">전체</option>
                    {projectFilterOptions.map((project) => (
                      <option key={project.projectId} value={project.projectId}>
                        {project.projectName}
                      </option>
                    ))}
                  </select>
                </label>

                {/* 스캔 방식 */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">방식</span>
                  <div className="flex gap-1">
                    {([
                      { value: '' as const, label: '전체' },
                      { value: 'UPLOAD' as const, label: 'Upload' },
                      { value: 'AGENT' as const, label: 'Agent' },
                    ] satisfies { value: ScanMode | ''; label: string }[]).map((opt) => (
                      <button
                        className={`px-2.5 py-1 text-xs font-bold transition landing-inner-radius ${
                          filterScanMode === opt.value
                            ? 'bg-black text-white'
                            : 'border border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400 hover:text-black'
                        }`}
                        key={opt.value || 'all-mode'}
                        onClick={() => handleFilterChange(opt.value, filterStatus)}
                        type="button"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 결과 */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">결과</span>
                  <div className="flex gap-1">
                    {([
                      { value: '' as const, label: '전체' },
                      { value: 'DONE' as const, label: '완료' },
                      { value: 'FAILED' as const, label: '실패' },
                    ] satisfies { value: 'DONE' | 'FAILED' | ''; label: string }[]).map((opt) => (
                      <button
                        className={`px-2.5 py-1 text-xs font-bold transition landing-inner-radius ${
                          filterStatus === opt.value
                            ? 'bg-black text-white'
                            : 'border border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400 hover:text-black'
                        }`}
                        key={opt.value || 'all-status'}
                        onClick={() => handleFilterChange(filterScanMode, opt.value)}
                        type="button"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <ScanTimeline
              deletingScanIds={deletingScanIds}
              emptyMessage="아직 저장된 스캔 이력이 없습니다."
              isLoading={isLoading}
              items={visibleHistoryItems.map((item) => ({
                scanId: item.scanId,
                status: item.status,
                scanMode: item.scanMode,
                scanType: item.scanType,
                source: item.source,
                requestedAt: item.requestedAt,
                completedAt: item.completedAt,
                projectId: item.projectId,
                projectName: projectNameMap[item.projectId],
                severity: {
                  critical: item.criticalCount,
                  high: item.highCount,
                  medium: item.mediumCount,
                  low: item.lowCount,
                },
              }))}
              onDeleteScan={(scanId) => void handleDeleteScan(scanId)}
              showProjectChip
            />
          </section>
        </div>
      )}
    </section>
  );
}

export default HistoryPage;
