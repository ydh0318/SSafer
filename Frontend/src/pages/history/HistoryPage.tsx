import { FolderKanban, GitCompare, Info, ScanSearch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import PageHero from '../../components/common/PageHero';
import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import { useAuthStore } from '../../store/authStore';

function HistoryPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isGuestSession = user?.role === 'GUEST';

  return (
    <section className="space-y-8">
      <PageHero
        aside={
          <div className="border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-500">COMPARE STATUS</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-black">히스토리와 결과 비교 준비 중</h2>
              </div>
              <PixelGoose mood="working" size={84} />
            </div>
            <p className="mt-4 text-sm leading-7 text-neutral-600">
              결과 API는 실제 데이터로 연결했지만, 히스토리 비교 화면은 아직 비교 API 응답 스키마에 맞춰 붙이는 단계가 남아 있습니다.
            </p>
          </div>
        }
        description="가짜 비교 데이터로 오해가 생기지 않도록, 목업 히스토리 데이터는 제거하고 현재 상태를 명확히 안내합니다."
        eyebrow="SCAN HISTORY"
        title="실제 비교 API 연결 전 안내"
      />

      {isGuestSession ? (
        <div className="border border-dashed border-neutral-300 bg-white p-10">
          <div className="flex flex-col items-start gap-5 md:flex-row md:items-center">
            <PixelGoose mood="sleeping" size={88} />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-500">GUEST MODE</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-black">게스트 모드에서는 히스토리가 저장되지 않습니다.</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-600">
                게스트도 스캔과 결과 확인은 가능하지만, 세션이 종료되면 비교 대상이 남지 않아 히스토리와 결과 비교는 제공하지 않습니다.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="border border-neutral-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-black">
              <Info className="h-4 w-4" />
              실제 비교 API 연결 전 상태
            </div>
            <div className="mt-6 space-y-4 text-sm leading-7 text-neutral-600">
              <p>
                기존 히스토리 페이지는 목업 `scanId`와 가짜 비교 결과를 사용하고 있었습니다. 결과 API 연결 확인에 혼선이 생기지 않도록 해당 목업 데이터는 제거했습니다.
              </p>
              <p>
                현재는 `프로젝트 상세 → 스캔 생성 → 스캔 상세 → 결과 페이지 → finding 상세` 흐름이 실제 API 기준으로 가장 정확하게 검증됩니다.
              </p>
              <p>
                히스토리 화면은 이후 `GET /api/v1/history/scans` 와 `GET /api/v1/scans/compare` 응답 스키마를 맞춰 다시 연결하는 것이 안전합니다.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <button
                className="flex items-center gap-3 border border-neutral-300 px-5 py-4 text-left transition hover:border-black hover:bg-[#f5f5f5]"
                onClick={() => navigate(ROUTES.projects)}
                type="button"
              >
                <FolderKanban className="h-5 w-5" />
                <div>
                  <div className="font-bold text-black">프로젝트로 이동</div>
                  <div className="text-xs text-neutral-500">실제 스캔 생성과 결과 확인</div>
                </div>
              </button>

              <button
                className="flex items-center gap-3 border border-neutral-300 px-5 py-4 text-left transition hover:border-black hover:bg-[#f5f5f5]"
                onClick={() => navigate(ROUTES.dashboard)}
                type="button"
              >
                <ScanSearch className="h-5 w-5" />
                <div>
                  <div className="font-bold text-black">대시보드로 이동</div>
                  <div className="text-xs text-neutral-500">실제 완료 스캔에서 결과 진입</div>
                </div>
              </button>
            </div>
          </div>

          <aside className="border-2 border-black bg-white">
            <div className="flex items-center justify-between bg-black px-5 py-3 text-white">
              <span className="font-black tracking-tight">다음 연결 예정</span>
              <GitCompare className="h-4 w-4" />
            </div>
            <div className="space-y-4 p-5 text-sm text-neutral-600">
              <div className="border border-neutral-200 bg-[#f5f5f5] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">STEP 1</div>
                <div className="mt-2 font-bold text-black">히스토리 스캔 목록 API 연결</div>
                <div className="mt-1">`GET /api/v1/history/scans`</div>
              </div>
              <div className="border border-neutral-200 bg-[#f5f5f5] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">STEP 2</div>
                <div className="mt-2 font-bold text-black">base/target 선택 및 결과 비교 API 연결</div>
                <div className="mt-1">`GET /api/v1/scans/compare`</div>
              </div>
              <div className="border border-[#FFE066] bg-[#FFF9DB] p-4 text-neutral-800">
                목업 비교 결과를 먼저 보여주는 대신, 실제 응답 형식이 정리된 뒤 연결하는 편이 오류 없이 검증하기 좋습니다.
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

export default HistoryPage;
