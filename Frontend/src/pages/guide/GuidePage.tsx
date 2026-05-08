import { ArrowRight, Copy, Terminal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import FeatureBanner from '../../components/common/FeatureBanner';
import FeatureInfoCard from '../../components/common/FeatureInfoCard';
import PixelGoose from '../../components/common/PixelGoose';
import SiteHeader from '../../components/layout/SiteHeader';
import { ROUTES } from '../../constants/routes';

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
            <aside className="theme-dark-soft-card border border-black/5 bg-white">
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
                      description="설치가 끝나면 터미널에서 바로 SSAFER 명령어를 사용할 수 있습니다."
                      eyebrow="01"
                      footer={
                        <div className="flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                          <span>
                            <span className="text-neutral-500">$</span> pip install ssafer
                          </span>
                          <Copy className="h-4 w-4 text-neutral-500" />
                        </div>
                      }
                      title={<h3 className="text-xl font-black tracking-tight">설치</h3>}
                    />
                    <FeatureInfoCard
                      eyebrow="02"
                      footer={
                        <div className="flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                          <span>
                            <span className="text-neutral-500">$</span> ssafer login --token YOUR_TOKEN
                          </span>
                          <Copy className="h-4 w-4 text-neutral-500" />
                        </div>
                      }
                      title={<h3 className="text-xl font-black tracking-tight">로그인</h3>}
                    />
                    <FeatureInfoCard
                      eyebrow="03"
                      footer={
                        <div className="flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                          <span>
                            <span className="text-neutral-500">$</span> ssafer run --upload --project shopping-mall-api
                          </span>
                          <Copy className="h-4 w-4 text-neutral-500" />
                        </div>
                      }
                      title={<h3 className="text-xl font-black tracking-tight">실행</h3>}
                    />
                  </>
                ) : null}

                {active === 1 ? (
                  <>
                    <FeatureInfoCard
                      description="설치 스크립트를 실행하면 Agent 기본 파일이 서버에 배치됩니다."
                      eyebrow="01"
                      footer={
                        <div className="flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                          <span>
                            <span className="text-neutral-500">$</span> curl -sSL https://ssafer.io/install-agent.sh | bash
                          </span>
                          <Copy className="h-4 w-4 text-neutral-500" />
                        </div>
                      }
                      title={<h3 className="text-xl font-black tracking-tight">Agent 설치</h3>}
                    />
                    <FeatureInfoCard
                      description="발급받은 토큰과 projectId를 설정 파일에 넣어 연결 대상을 지정합니다."
                      eyebrow="02"
                      footer={
                        <div className="bg-black p-4 font-mono text-sm text-green-400">
                          <div>
                            <span className="text-neutral-500"># /etc/ssafer/agent.yml</span>
                          </div>
                          <div>token: AGENT_TOKEN_HERE</div>
                          <div>projectId: 101</div>
                          <div>endpoint: wss://api.ssafer.io/v1/agents/connect</div>
                        </div>
                      }
                      title={<h3 className="text-xl font-black tracking-tight">설정</h3>}
                    />
                    <FeatureInfoCard
                      eyebrow="03"
                      footer={
                        <div className="bg-black p-4 font-mono text-sm text-green-400">
                          <div>
                            <span className="text-neutral-500">$</span> sudo systemctl start ssafer-agent
                          </div>
                          <div>
                            <span className="text-neutral-500">$</span> sudo systemctl enable ssafer-agent
                          </div>
                        </div>
                      }
                      title={<h3 className="text-xl font-black tracking-tight">실행</h3>}
                    />
                  </>
                ) : null}

                {active === 2 ? (
                  <>
                    <FeatureInfoCard
                      description="Before / After diff를 보면서 어떤 수정이 들어가는지 먼저 확인할 수 있습니다."
                      eyebrow="01"
                      title={<h3 className="text-xl font-black tracking-tight">diff 확인</h3>}
                    />
                    <FeatureInfoCard
                      description="패치 승인은 Agent와 CLI 흐름 모두에서 같은 방식으로 이어집니다."
                      eyebrow="02"
                      title={<h3 className="text-xl font-black tracking-tight">승인 진행</h3>}
                    />
                    <FeatureInfoCard
                      description="적용 결과는 scanId 기준으로 남아서 이후 비교와 공유에 그대로 활용할 수 있습니다."
                      eyebrow="03"
                      title={<h3 className="text-xl font-black tracking-tight">결과 저장</h3>}
                    />
                  </>
                ) : null}

                <FeatureInfoCard
                  description={
                    active === 0
                      ? 'CLI는 가장 빠르게 시작하기 좋은 방식입니다. 설치 후 바로 프로젝트에 결과를 연결할 수 있습니다.'
                      : active === 1
                        ? 'Agent는 서버 연결 상태를 기준으로 동작합니다. 먼저 ONLINE 상태인지 확인해 주세요.'
                        : '패치 승인 흐름에서는 diff 확인, 승인, 적용 결과 확인을 순서대로 따라가면 됩니다.'
                  }
                  eyebrow="TIP"
                  title={
                    <div className="flex items-center gap-3">
                      <PixelGoose mood="happy" size={32} />
                      <span className="text-sm font-bold">SSAFER가 먼저 챙겨볼 포인트</span>
                    </div>
                  }
                  tone="accent"
                />

                <section className="bg-[#111111] p-5 text-white">
                  <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#D4FC64]">NEXT STEP</p>
                  <h4 className="mt-2 text-lg font-bold">
                    {active === 0
                      ? 'CLI 설치 후 로그인하고 프로젝트를 선택해 첫 스캔을 올려보세요.'
                      : active === 1
                        ? 'Agent가 ONLINE 상태가 되면 바로 서버 점검 흐름을 시작할 수 있습니다.'
                        : '패치 승인 화면에서 diff를 먼저 확인하고 적용 여부를 결정해 보세요.'}
                  </h4>
                  <Link className="theme-accent-card mt-4 inline-flex items-center gap-2 bg-[#D4FC64] px-4 py-2 text-sm font-bold !text-black" to={ROUTES.login}>
                    <Terminal className="h-4 w-4" />
                    시작하기
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </section>
              </div>
            </article>
          </div>
        </div>
      </main>
    </div>
  );
}

export default GuidePage;
