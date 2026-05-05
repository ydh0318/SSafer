import { ArrowRight, Info, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';

import PageHero from '../../components/common/PageHero';
import PixelGoose from '../../components/common/PixelGoose';
import ScanStatusBadge from '../../features/scans/components/ScanStatusBadge';
import { historyScans } from '../../mocks/ssaferShowcase';
import { useAuthStore } from '../../store/authStore';

function HistoryPage() {
  const [base, setBase] = useState<number | null>(1004);
  const [target, setTarget] = useState<number | null>(1001);
  const [comparing, setComparing] = useState(false);
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
                <h2 className="mt-3 text-2xl font-black tracking-tight text-black">스캔 비교</h2>
              </div>
              <PixelGoose mood="working" size={84} />
            </div>
            <p className="mt-4 text-sm leading-7 text-neutral-600">
              같은 프로젝트의 스캔을 기준점과 대상점으로 고르면, 새로 생긴 항목과 해결된 항목을 바로 비교할 수 있습니다.
            </p>
          </div>
        }
        description="scanId 기준으로 이전 결과와 현재 결과를 비교하고, 어떤 보안 설정이 좋아졌는지 한눈에 확인할 수 있습니다."
        eyebrow="SCAN HISTORY"
        title="히스토리와 결과 비교"
      />

      <div className="border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-neutral-500">최근 30일 finding 추이</p>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="h-2 w-2 bg-[#E63946]" />Critical</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 bg-[#FF8A33]" />High</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 bg-[#FFB627]" />Medium</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 bg-[#3D5AFE]" />Low</span>
          </div>
        </div>
        <div className="mt-5 flex h-40 items-end gap-1 border-b border-neutral-200 pb-1">
          {[
            [3, 5, 7, 10],
            [2, 4, 6, 9],
            [4, 6, 8, 11],
            [3, 5, 6, 8],
            [2, 3, 5, 7],
            [1, 2, 4, 6],
            [4, 7, 9, 12],
            [2, 4, 7, 10],
            [3, 5, 8, 11],
            [1, 3, 6, 9],
            [2, 4, 5, 8],
            [1, 2, 4, 7],
          ].map((day, index) => (
            <div className="flex flex-1 flex-col-reverse" key={index}>
              <div style={{ height: `${day[0] * 4}px`, background: '#E63946' }} />
              <div style={{ height: `${day[1] * 3}px`, background: '#FF8A33' }} />
              <div style={{ height: `${day[2] * 2}px`, background: '#FFB627' }} />
              <div style={{ height: `${day[3] * 2}px`, background: '#3D5AFE' }} />
            </div>
          ))}
        </div>
      </div>

      {isGuestSession ? (
        <div className="border border-dashed border-neutral-300 bg-white p-10">
          <div className="flex flex-col items-start gap-5 md:flex-row md:items-center">
            <PixelGoose mood="sleeping" size={88} />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-500">GUEST MODE</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-black">게스트 모드에서는 히스토리가 저장되지 않습니다.</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-600">
                스캔 실행, 결과 확인, 가이드와 타이핑 챌린지는 그대로 사용할 수 있습니다. 다만 게스트 세션에서 만든 기록은 누적되지 않고 세션이 끝나면 사라집니다.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="border border-neutral-200 bg-white">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <h2 className="font-black tracking-tight text-black">전체 스캔</h2>
              <div className="flex items-center gap-2 text-xs">
                <select className="border border-neutral-200 px-2 py-1">
                  <option>모든 프로젝트</option>
                  <option>shopping-mall-api</option>
                </select>
                <select className="border border-neutral-200 px-2 py-1">
                  <option>모든 상태</option>
                  <option>DONE</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 border-b border-[#FFE066] bg-[#FFF9DB] px-5 py-3 text-xs text-neutral-700">
              <Info className="h-3.5 w-3.5" />
              두 스캔을 골라서 비교할 수 있습니다. 같은 프로젝트끼리 비교하면 가장 의미가 큽니다.
            </div>
            {historyScans.map((scan) => {
              const isBase = scan.id === base;
              const isTarget = scan.id === target;
              const selected = isBase || isTarget;

              return (
                <button
                  className={`flex w-full items-center gap-3 border-b border-neutral-100 px-5 py-4 text-left last:border-b-0 ${
                    selected ? 'bg-[#F5F5F5]' : 'hover:bg-[#F5F5F5]'
                  }`}
                  key={scan.id}
                  onClick={() => {
                    if (scan.status !== 'DONE') {
                      return;
                    }

                    if (isTarget) {
                      setTarget(null);
                      return;
                    }

                    if (isBase) {
                      setBase(null);
                      return;
                    }

                    if (!base) {
                      setBase(scan.id);
                      return;
                    }

                    setTarget(scan.id);
                  }}
                  type="button"
                >
                  <input checked={selected} className="accent-black" readOnly type="checkbox" />
                  {isBase ? <span className="bg-black px-2 py-0.5 text-[10px] font-bold tracking-[0.22em] text-white">BASE</span> : null}
                  {isTarget ? <span className="bg-[#3DDC84] px-2 py-0.5 text-[10px] font-bold tracking-[0.22em] text-black">TARGET</span> : null}
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-black">{scan.name}</div>
                    <div className="font-mono text-[11px] text-neutral-400">
                      scanId #{scan.id} · {scan.scanMode} · {scan.time}
                    </div>
                  </div>
                  <ScanStatusBadge status={scan.status} />
                </button>
              );
            })}
          </div>

          <aside className="sticky top-24 h-fit border-2 border-black bg-white">
            <div className="flex items-center justify-between bg-black px-5 py-3 text-white">
              <span className="font-black tracking-tight">결과 비교</span>
              <PixelGoose mood="working" size={32} />
            </div>
            <div className="space-y-4 p-5">
              <div>
                <div className="mb-1 text-[10px] font-bold tracking-[0.24em] text-neutral-500">BASE</div>
                <div className="bg-[#F5F5F5] p-2 font-mono text-xs">{base ? `scanId #${base}` : '선택 안 됨'}</div>
              </div>
              <div className="text-center text-neutral-300">
                <ArrowRight className="mx-auto h-4 w-4 rotate-90" />
              </div>
              <div>
                <div className="mb-1 text-[10px] font-bold tracking-[0.24em] text-[#3DDC84]">TARGET</div>
                <div className="bg-[#F5F5F5] p-2 font-mono text-xs">{target ? `scanId #${target}` : '선택 안 됨'}</div>
              </div>

              <button
                className="w-full bg-black py-3 text-sm font-bold tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-30"
                disabled={!base || !target}
                onClick={() => setComparing(true)}
                type="button"
              >
                비교하기
              </button>

              {comparing && base && target ? (
                <div className="space-y-3 border-t border-neutral-200 pt-4">
                  <div className="flex items-center justify-between bg-[#FFE5E5] p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-[#E63946]" />
                      새로 생긴 finding
                    </div>
                    <span className="text-2xl font-black text-[#E63946]">+1</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#E6F9EE] p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingDown className="h-4 w-4 text-[#0A7C2E]" />
                      해결된 finding
                    </div>
                    <span className="text-2xl font-black text-[#0A7C2E]">-19</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#F5F5F5] p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Minus className="h-4 w-4" />
                      그대로
                    </div>
                    <span className="text-2xl font-black">16</span>
                  </div>
                  <div className="bg-black p-4 text-sm text-white">
                    <span className="font-bold text-[#3DDC84]">19건이 사라졌어요!</span> 패치 적용 효과가 분명하게 보입니다.
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

export default HistoryPage;
