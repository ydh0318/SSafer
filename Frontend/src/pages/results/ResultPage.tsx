import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import MetricCard from '../../components/common/MetricCard';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
import { getScanStatus } from '../../features/scans/api/scans';
import ScanStatusBadge from '../../features/scans/components/ScanStatusBadge';
import { formatDateTime } from '../../features/scans/utils/scanPresentation';
import type { ScanProgressStatusData } from '../../types/scan';

type ResultRouteState = {
  projectId?: string;
};

function ResultPage() {
  const { scanId = '' } = useParams<{ scanId: string }>();
  const location = useLocation();
  const routeState = (location.state ?? {}) as ResultRouteState;

  const [statusData, setStatusData] = useState<ScanProgressStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!scanId) {
      return;
    }

    let isMounted = true;

    const loadStatus = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await getScanStatus(scanId);

        if (!isMounted) {
          return;
        }

        setStatusData(data);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatusData(null);
        setErrorMessage(error instanceof Error ? error.message : '결과 상태를 불러오지 못했습니다.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadStatus();

    return () => {
      isMounted = false;
    };
  }, [scanId]);

  return (
    <section className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-[#eadfcb] bg-[linear-gradient(135deg,#fffdf8_0%,#f6efe0_52%,#efe7d9_100%)] px-6 py-8 shadow-[0_24px_90px_rgba(15,23,42,0.08)] md:px-8 md:py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#8b7f6a]">결과 확인</p>
        <h2 className="mt-4 text-4xl font-black leading-tight text-[#111111] md:text-5xl">스캔 #{scanId} 결과 상태</h2>
        <p className="mt-5 max-w-3xl text-base leading-8 text-[#5f564c]">
          현재는 스캔 완료 여부와 결과 준비 상태를 먼저 보여주며, 이후 상세 결과 API가 연결되면 이 화면에서 함께 확인할 수 있습니다.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex rounded-full border border-[#cbbda6] px-5 py-3 text-sm font-bold text-[#3f352b] transition hover:border-[#9f937f]"
            state={routeState}
            to={ROUTES.scanDetail.replace(':scanId', scanId)}
          >
            상태 페이지로 돌아가기
          </Link>
          {routeState.projectId ? (
            <Link
              className="inline-flex rounded-full border border-[#cbbda6] px-5 py-3 text-sm font-bold text-[#3f352b] transition hover:border-[#9f937f]"
              to={ROUTES.projectDetail.replace(':projectId', routeState.projectId)}
            >
              프로젝트 상세로 이동
            </Link>
          ) : null}
        </div>
      </section>

      <SectionPanel
        description="현재 백엔드 상태 기준으로 결과 확인 가능 여부를 보여줍니다."
        eyebrow="결과 준비 상태"
        title="현재 결과 상태"
      >
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
            결과 상태를 불러오는 중입니다...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : statusData ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <ScanStatusBadge status={statusData.status} />
              <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-bold text-white">
                스캔 #{statusData.scanId}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard helper="백엔드가 알려주는 현재 단계입니다." label="현재 단계" tone="sky" value={statusData.progressStep ?? '-'} />
              <MetricCard helper="스캔 시작 시각입니다." label="시작 시각" tone="plain" value={formatDateTime(statusData.startedAt)} />
              <MetricCard helper="스캔 종료 시각입니다." label="완료 시각" tone="green" value={formatDateTime(statusData.completedAt)} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {statusData.status === 'DONE'
                ? '스캔이 완료되었습니다. 상세 결과 API가 연결되면 이 화면에서 더 구체적인 결과를 이어서 확인할 수 있습니다.'
                : '아직 결과가 준비되지 않았습니다. 상태 페이지에서 진행 상황을 계속 확인해주세요.'}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
            조회할 결과 상태 정보가 없습니다.
          </div>
        )}
      </SectionPanel>
    </section>
  );
}

export default ResultPage;
