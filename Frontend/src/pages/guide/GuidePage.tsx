import { ArrowRight, Copy, Terminal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import PixelGoose from '../../components/common/PixelGoose';
import SiteHeader from '../../components/layout/SiteHeader';
import { ROUTES } from '../../constants/routes';

const guideSections = [
  {
    title: 'CLI 설치 가이드',
    category: 'CLI',
    headline: '터미널에서 SSAfer CLI를 설치하고 업로드 스캔까지 실행하는 기본 흐름입니다.',
  },
  {
    title: 'Local Agent 설치 가이드',
    category: 'AGENT',
    headline: '서버에 Agent를 설치해두면 웹에서 원격 점검과 패치 적용까지 이어갈 수 있습니다.',
  },
  {
    title: '패치 승인 흐름',
    category: 'PATCH',
    headline: 'Finding 검토부터 승인, 적용, 결과 확인까지 실제 패치 흐름을 짧게 정리했습니다.',
  },
];

function GuidePage() {
  const [active, setActive] = useState(1);
  const current = useMemo(() => guideSections[active] ?? guideSections[0], [active]);

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-black">
      <SiteHeader showSessionBar={false} />

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-neutral-500">guide</p>
            <h1 className="mt-3 text-5xl font-black tracking-tight">사용 가이드</h1>
            <p className="mt-3 text-neutral-600">설치부터 실행, 패치 적용까지 필요한 흐름만 빠르게 확인할 수 있습니다.</p>
          </div>
          <PixelGoose mood="working" size={88} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="border border-neutral-200 bg-white">
            {guideSections.map((section, index) => (
              <button
                className={`flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left last:border-b-0 ${
                  active === index ? 'border-l-2 border-l-black bg-[#F5F5F5]' : 'hover:bg-[#F5F5F5]'
                }`}
                key={section.title}
                onClick={() => setActive(index)}
                type="button"
              >
                <span className="w-6 font-mono text-xs text-neutral-400">0{index + 1}</span>
                <span className="flex-1 text-sm font-bold">{section.title}</span>
                <span className="text-[10px] font-bold tracking-[0.24em] text-neutral-400">{section.category}</span>
              </button>
            ))}
          </aside>

          <article className="border border-neutral-200 bg-white p-10">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-neutral-500">
              GUIDE 0{active + 1} · {current.category}
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight">{current.title}</h2>
            <p className="mt-4 max-w-3xl text-neutral-600">{current.headline}</p>

            <div className="mt-10 space-y-6">
              {active === 0 ? (
                <>
                  <section>
                    <h3 className="text-xl font-black tracking-tight">1. 설치</h3>
                    <div className="mt-3 flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                      <span><span className="text-neutral-500">$</span> pip install ssafer</span>
                      <Copy className="h-4 w-4 text-neutral-500" />
                    </div>
                  </section>
                  <section>
                    <h3 className="text-xl font-black tracking-tight">2. 로그인</h3>
                    <div className="mt-3 flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                      <span><span className="text-neutral-500">$</span> ssafer login --token YOUR_TOKEN</span>
                      <Copy className="h-4 w-4 text-neutral-500" />
                    </div>
                  </section>
                  <section>
                    <h3 className="text-xl font-black tracking-tight">3. 실행</h3>
                    <div className="mt-3 flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                      <span><span className="text-neutral-500">$</span> ssafer run --upload --project shopping-mall-api</span>
                      <Copy className="h-4 w-4 text-neutral-500" />
                    </div>
                  </section>
                </>
              ) : null}

              {active === 1 ? (
                <>
                  <section>
                    <h3 className="text-xl font-black tracking-tight">1. 다운로드</h3>
                    <p className="mt-2 text-sm text-neutral-700">서버에서 설치 스크립트를 실행합니다.</p>
                    <div className="mt-3 flex items-center justify-between bg-black p-4 font-mono text-sm text-green-400">
                      <span><span className="text-neutral-500">$</span> curl -sSL https://ssafer.io/install-agent.sh | bash</span>
                      <Copy className="h-4 w-4 text-neutral-500" />
                    </div>
                  </section>
                  <section>
                    <h3 className="text-xl font-black tracking-tight">2. 토큰 설정</h3>
                    <p className="mt-2 text-sm text-neutral-700">발급받은 토큰과 projectId를 Agent 설정 파일에 넣습니다.</p>
                    <div className="mt-3 bg-black p-4 font-mono text-sm text-green-400">
                      <div><span className="text-neutral-500"># /etc/ssafer/agent.yml</span></div>
                      <div>token: AGENT_TOKEN_HERE</div>
                      <div>projectId: 101</div>
                      <div>endpoint: wss://api.ssafer.io/v1/agents/connect</div>
                    </div>
                  </section>
                  <section>
                    <h3 className="text-xl font-black tracking-tight">3. 시작</h3>
                    <div className="mt-3 bg-black p-4 font-mono text-sm text-green-400">
                      <div><span className="text-neutral-500">$</span> sudo systemctl start ssafer-agent</div>
                      <div><span className="text-neutral-500">$</span> sudo systemctl enable ssafer-agent</div>
                    </div>
                  </section>
                </>
              ) : null}

              {active === 2 ? (
                <>
                  <section>
                    <h3 className="text-xl font-black tracking-tight">1. 수정안 확인</h3>
                    <p className="mt-2 text-sm leading-7 text-neutral-700">Finding 상세 화면에서 before/after diff를 보고 수정안을 검토합니다.</p>
                  </section>
                  <section>
                    <h3 className="text-xl font-black tracking-tight">2. 승인 후 적용</h3>
                    <p className="mt-2 text-sm leading-7 text-neutral-700">승인하면 실제 패치가 적용되고 결과가 기록됩니다.</p>
                  </section>
                  <section>
                    <h3 className="text-xl font-black tracking-tight">3. 결과 검토</h3>
                    <p className="mt-2 text-sm leading-7 text-neutral-700">적용 결과와 백업 파일 정보를 확인하고 필요하면 바로 롤백할 수 있습니다.</p>
                  </section>
                </>
              ) : null}

              <section className="theme-guide-tip border border-[#FFE066] bg-[#FFF9DB] p-5">
                <div className="flex items-center gap-3">
                  <PixelGoose mood="happy" size={32} />
                  <div className="text-sm font-bold">SSAfer의 팁</div>
                </div>
                <p className="mt-3 text-sm leading-7 text-neutral-700">
                  {active === 0
                    ? 'CLI는 로컬에서 마스킹을 끝낸 뒤 업로드하므로 민감한 값 원문이 그대로 서버로 가지 않습니다.'
                    : active === 1
                      ? 'Agent는 keepalive를 보내며 응답이 끊기면 OFFLINE으로 표시됩니다.'
                      : '패치 전에는 diff와 백업 경로를 함께 확인해두면 롤백이 훨씬 편합니다.'}
                </p>
              </section>

              <section className="bg-black p-5 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#3DDC84]">다음 단계</p>
                <h4 className="mt-2 text-lg font-bold">
                  {active === 0
                    ? 'CLI 준비가 끝났다면 바로 업로드 스캔을 시작해보세요.'
                    : active === 1
                      ? 'Agent가 ONLINE 상태가 되면 원격 점검을 시작할 수 있습니다.'
                      : '패치 승인 흐름을 확인했다면 실제 finding을 열어보세요.'}
                </h4>
                <Link className="mt-4 inline-flex items-center gap-2 bg-[#3DDC84] px-4 py-2 text-sm font-bold text-black" to={ROUTES.login}>
                  <Terminal className="h-4 w-4" />
                  시작하기
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </section>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

export default GuidePage;
