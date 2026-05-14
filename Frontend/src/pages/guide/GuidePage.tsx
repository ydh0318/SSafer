import { ArrowRight, Check, Copy, Eye, EyeOff, Terminal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import FeatureBanner from '../../components/common/FeatureBanner';
import FeatureInfoCard from '../../components/common/FeatureInfoCard';
import PixelGoose from '../../components/common/PixelGoose';
import SiteHeader from '../../components/layout/SiteHeader';
import { ROUTES } from '../../constants/routes';
import { useAuthStore } from '../../store/authStore';

const guideSections = [
  {
    title: 'CLI 시작 가이드',
    category: 'CLI',
    headline: 'SSAFER CLI를 설치하고 로그인한 뒤, 프로젝트에 바로 스캔 결과를 업로드할 수 있습니다.',
  },
  {
    title: 'Local Agent 연결 가이드',
    category: 'AGENT',
    headline: 'Agent를 서버에 설치하고 프로젝트와 연결하면 원격 점검 흐름을 바로 시작할 수 있습니다.',
  },
  {
    title: '패치 승인 흐름',
    category: 'PATCH',
    headline: 'Finding을 검토하고 diff와 승인 흐름을 따라가며 수정 작업을 팀과 함께 이어갈 수 있습니다.',
  },
] as const;

function GuidePage() {
  const [active, setActive] = useState(0);
  const current = useMemo(() => guideSections[active] ?? guideSections[0], [active]);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isGuest = isAuthenticated && !refreshToken;

  const handleCopyCommand = async () => {
    if (!accessToken) return;
    await navigator.clipboard.writeText(`ssafer login --guest-token ${accessToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="site-shell-with-nav theme-guide-page min-h-screen bg-[#FAFAF7] text-black">
      <SiteHeader showSessionBar={false} />

      <main className="site-shell-main min-w-0 flex-1">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <FeatureBanner
            aside={<PixelGoose mood="working" size={88} />}
            className="theme-guide-hero bg-white"
            description={
              <span className="whitespace-nowrap">
                CLI, Agent, 패치 승인 흐름처럼 제품의 핵심 기능을 페이지별 배너 문구와 한줄 짧은 코드 예시 중심으로 정리합니다.
              </span>
            }
            eyebrow="GUIDE"
            title={
              <div>
                <div className="text-sm text-neutral-500">핵심 기능 빠르게 보기</div>
                <h1 className="mt-3 text-5xl font-black tracking-tight md:text-6xl">읽어보세요</h1>
              </div>
            }
          />

          <div className="mt-8 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="theme-dark-soft-card flex flex-col border border-black/5 bg-white">
              {/* 섹션 탭 */}
              <div>
                {guideSections.map((section, index) => (
                  <button
                    className={`flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-4 text-left last:border-b-0 ${
                      active === index ? 'bg-[#111111] text-white' : 'hover:bg-[#F5F5F5]'
                    }`}
                    key={section.title}
                    onClick={() => setActive(index)}
                    type="button"
                  >
                    <span className={`w-6 font-mono text-xs ${active === index ? 'text-[#D4FC64]' : 'text-neutral-400'}`}>0{index + 1}</span>
                    <span className="flex-1 text-sm font-bold">{section.title}</span>
                    <span className="text-[10px] font-bold tracking-[0.24em] text-neutral-400">{section.category}</span>
                  </button>
                ))}
              </div>

              {/* TIP + NEXT STEP */}
              <div className="border-t border-neutral-100 p-3 space-y-2">
                {/* TIP */}
                <div className="border-l-2 border-[#D4FC64] bg-[#F6FDE8] px-4 py-3.5">
                  <span className="font-mono text-[9px] font-black tracking-[0.28em] text-[#7AAD00]">TIP</span>
                  <div className="mt-2 flex items-center gap-2">
                    <PixelGoose mood="happy" size={20} />
                    <span className="text-xs font-bold">SSAFER가 먼저 챙겨볼 포인트</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">
                    {active === 0
                      ? 'CLI는 가장 빠르게 시작하기 좋은 방식입니다. 설치 후 바로 프로젝트에 결과를 연결할 수 있습니다.'
                      : active === 1
                        ? 'Agent는 서버 연결 상태를 기준으로 동작합니다. 먼저 ONLINE 상태인지 확인해 주세요.'
                        : '패치 승인 흐름에서는 diff 확인, 승인, 적용 결과 확인을 순서대로 따라가면 됩니다.'}
                  </p>
                </div>

                {/* NEXT STEP */}
                <div className="bg-[#111111] px-4 py-4">
                  <span className="font-mono text-[9px] font-black tracking-[0.28em] text-[#D4FC64]">NEXT STEP</span>
                  <p className="mt-2 text-xs font-bold leading-relaxed text-neutral-300">
                    {active === 0
                      ? 'CLI 설치 후 로그인하고 프로젝트를 선택해 첫 스캔을 올려보세요.'
                      : active === 1
                        ? 'Agent가 ONLINE 상태가 되면 바로 서버 점검 흐름을 시작할 수 있습니다.'
                        : '패치 승인 화면에서 diff를 먼저 확인하고 적용 여부를 결정해 보세요.'}
                  </p>
                  <Link
                    className="mt-3 inline-flex items-center gap-2 bg-[#D4FC64] px-4 py-2 text-xs font-black text-black transition hover:bg-[#c8f050]"
                    to={ROUTES.login}
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    시작하기
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </aside>

            <article className="theme-dark-soft-card border border-black/5 bg-white p-8 md:p-10">
              <p className="text-xs font-mono uppercase tracking-[0.32em] text-neutral-400">
                GUIDE 0{active + 1} · {current.category}
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">{current.title}</h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-neutral-600">{current.headline}</p>

              <div className="mt-10 space-y-6">
                {active === 0 ? (
                  <>
                    <FeatureInfoCard
                      description="SSAfer 계정으로 로그인하고, 스캔 결과를 웹에 업로드할 준비를 합니다."
                      eyebrow="01"
                      footer={
                        <div className="flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                          <span>
                            <span className="text-neutral-500">$</span> ssafer login
                          </span>
                          <Copy className="h-4 w-4 text-neutral-500" />
                        </div>
                      }
                      title={<h3 className="text-xl font-black tracking-tight">로그인</h3>}
                    />
                    <FeatureInfoCard
                      description="로컬 환경에서 점검한 프로젝트를 웹에서 관리할 수 있도록 새로 생성합니다."
                      eyebrow="02"
                      footer={
                        <div className="flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                          <span>
                            <span className="text-neutral-500">$</span> ssafer project-create
                          </span>
                          <Copy className="h-4 w-4 text-neutral-500" />
                        </div>
                      }
                      title={<h3 className="text-xl font-black tracking-tight">프로젝트 생성</h3>}
                    />
                    <FeatureInfoCard
                      description="현재 폴더를 점검하고 결과 JSON을 생성함과 동시에 웹으로 바로 업로드합니다."
                      eyebrow="03"
                      footer={
                        <div className="flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                          <span>
                            <span className="text-neutral-500">$</span> ssafer run --upload
                          </span>
                          <Copy className="h-4 w-4 text-neutral-500" />
                        </div>
                      }
                      title={<h3 className="text-xl font-black tracking-tight">스캔 및 업로드</h3>}
                    />
                  </>
                ) : null}

                {active === 1 ? (
                  <>
                    <FeatureInfoCard
                      description="Agent를 통해 서버를 모니터링하기 전, 터미널 환경에서 로그인 상태를 만듭니다."
                      eyebrow="01"
                      footer={
                        <div className="flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                          <span>
                            <span className="text-neutral-500">$</span> ssafer login
                          </span>
                          <Copy className="h-4 w-4 text-neutral-500" />
                        </div>
                      }
                      title={<h3 className="text-xl font-black tracking-tight">로그인</h3>}
                    />
                    <FeatureInfoCard
                      description="Trivy 등 서버나 컨테이너 점검에 필요한 외부 보안 도구들을 시스템에 설치합니다."
                      eyebrow="02"
                      footer={
                        <div className="flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                          <span>
                            <span className="text-neutral-500">$</span> ssafer install-tools
                          </span>
                          <Copy className="h-4 w-4 text-neutral-500" />
                        </div>
                      }
                      title={<h3 className="text-xl font-black tracking-tight">필수 도구 설치</h3>}
                    />
                    <FeatureInfoCard
                      description="웹에서 보낸 스캔 및 패치 적용 요청을 현재 환경에서 즉시 처리할 수 있도록 Agent를 실행합니다."
                      eyebrow="03"
                      footer={
                        <div className="flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                          <span>
                            <span className="text-neutral-500">$</span> ssafer agent
                          </span>
                          <Copy className="h-4 w-4 text-neutral-500" />
                        </div>
                      }
                      title={<h3 className="text-xl font-black tracking-tight">Agent 실행</h3>}
                    />
                  </>
                ) : null}

                {active === 2 ? (
                  <>
                    <FeatureInfoCard
                      description="실제 파일을 즉시 바꾸지 않고, 코드 상에 어떤 수정안이 들어갈지 diff 형태로 미리 확인합니다."
                      eyebrow="01"
                      footer={
                        <div className="flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                          <span>
                            <span className="text-neutral-500">$</span> ssafer apply --dry-run
                          </span>
                          <Copy className="h-4 w-4 text-neutral-500" />
                        </div>
                      }
                      title={<h3 className="text-xl font-black tracking-tight">diff 확인</h3>}
                    />
                    <FeatureInfoCard
                      description="로컬에 남아있는 최근 분석 결과를 바탕으로 취약점 수정안(patch payload)을 프로젝트에 직접 적용합니다."
                      eyebrow="02"
                      footer={
                        <div className="flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                          <span>
                            <span className="text-neutral-500">$</span> ssafer apply
                          </span>
                          <Copy className="h-4 w-4 text-neutral-500" />
                        </div>
                      }
                      title={<h3 className="text-xl font-black tracking-tight">로컬 패치 적용</h3>}
                    />
                    <FeatureInfoCard
                      description="웹 환경에서 완료된 스캔 결과를 내려받아 터미널에서 즉시 수정안을 원격으로 반영합니다."
                      eyebrow="03"
                      footer={
                        <div className="flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                          <span>
                            <span className="text-neutral-500">$</span> ssafer apply --latest --project-id {'<id>'}
                          </span>
                          <Copy className="h-4 w-4 text-neutral-500" />
                        </div>
                      }
                      title={<h3 className="text-xl font-black tracking-tight">웹 결과 내려받아 적용</h3>}
                    />
                  </>
                ) : null}

                {isGuest && (
                  <div className="rounded-2xl border border-neutral-700 bg-[#1E1E1E] p-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">CLI 연동</p>
                    <p className="mt-1 text-base font-bold text-white">이 게스트 세션을 CLI에서 이어서 사용하기</p>

                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-neutral-700 bg-[#2A2A2A] px-4 py-3">
                      <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm text-[#D4FC64]">
                        ssafer login --guest-token{' '}
                        <span className="text-neutral-300">
                          {tokenVisible
                            ? accessToken
                            : `${accessToken?.slice(0, 12) ?? ''}${'•'.repeat(20)}`}
                        </span>
                      </code>

                      <button
                        className="shrink-0 rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-neutral-300"
                        onClick={() => setTokenVisible((v) => !v)}
                        title={tokenVisible ? '토큰 숨기기' : '토큰 표시'}
                        type="button"
                      >
                        {tokenVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>

                      <button
                        className="shrink-0 rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-neutral-300"
                        onClick={() => void handleCopyCommand()}
                        title="명령어 복사"
                        type="button"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-[#D4FC64]" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    <p className="mt-2 text-xs text-neutral-600">
                      토큰은 타인과 공유하지 마세요. 게스트 세션이 만료되면 CLI 연결도 함께 종료됩니다.
                    </p>
                  </div>
                )}

              </div>
            </article>
          </div>
        </div>
      </main>
    </div>
  );
}

export default GuidePage;
