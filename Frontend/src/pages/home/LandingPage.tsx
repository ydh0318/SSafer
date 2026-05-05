import {
  Activity,
  ArrowRight,
  Bug,
  Hash,
  Lock,
  Server,
  Shield,
  Terminal,
  Trophy,
  Upload,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import PixelGoose from '../../components/common/PixelGoose';
import SiteHeader from '../../components/layout/SiteHeader';
import { ROUTES } from '../../constants/routes';

function LandingPage() {
  const [typedText, setTypedText] = useState('');
  const fullText = 'ssafer run --upload';

  useEffect(() => {
    let index = 0;

    const timer = window.setInterval(() => {
      if (index <= fullText.length) {
        setTypedText(fullText.slice(0, index));
        index += 1;
      } else {
        index = 0;
      }
    }, 140);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-black">
      <SiteHeader showSessionBar={false} />

      <main>
        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 pb-20 pt-16 xl:grid-cols-[minmax(0,1.05fr)_420px] xl:items-center">
          <div>
            <h1 className="text-5xl font-black tracking-tight text-black md:text-7xl md:leading-[0.95]">
              보안 설정,
              <br />
              <span className="inline-block bg-black px-3 py-1 text-white">한 번에 끝내자.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-9 text-neutral-700">
              `.env`, `docker-compose`, `Dockerfile`, `sshd_config`.
              <br />
              놓치기 쉬운 보안 설정을 SSAfer가 스캔하고,
              <br />
              왜 위험한지와 어떻게 고칠지까지 빠르게 보여줍니다.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                className="inline-flex items-center gap-2 bg-black px-7 py-4 text-sm font-bold tracking-wide text-white transition hover:bg-neutral-800"
                to={ROUTES.login}
              >
                지금 스캔하기
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                className="inline-flex items-center gap-2 border border-neutral-300 px-7 py-4 text-sm font-bold tracking-wide text-black transition hover:bg-white"
                to={ROUTES.guide}
              >
                <Terminal className="h-4 w-4" />
                CLI 설치 가이드
              </Link>
            </div>

            <div className="mt-8 inline-flex items-center gap-2 bg-black px-5 py-4 font-mono text-sm text-green-400">
              <span className="text-neutral-500">$</span>
              <span>{typedText}</span>
              <span className="h-4 w-2 animate-pulse bg-green-400" />
            </div>
          </div>

          <div className="theme-dark-panel relative overflow-hidden border border-neutral-200 bg-white p-8">
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
                backgroundSize: '8px 8px',
              }}
            />
            <div className="absolute right-8 top-8 bg-black px-3 py-1.5 text-[10px] font-bold tracking-[0.28em] text-white">
              MEET SSAFER
            </div>
            <div className="flex min-h-[360px] items-center justify-center">
              <PixelGoose mood="happy" size={220} />
            </div>
            <div className="theme-accent-card absolute bottom-8 left-8 inline-flex items-center gap-1.5 bg-[#3DDC84] px-3 py-1.5 text-xs font-bold tracking-wide text-black">
              <Shield className="h-3 w-3" />
              결정론적 탐지
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 border border-black bg-white px-3 py-2 text-xs font-bold shadow-[4px_4px_0_0_#000]">
              Honk! 안녕!
            </div>
          </div>
        </section>

        <section className="theme-dark-banner border-y border-neutral-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-neutral-500">3 ways to scan</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight">상황에 맞게 골라서 시작하세요.</h2>
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {[
                {
                  icon: Upload,
                  mode: 'UPLOAD',
                  title: '웹 업로드',
                  desc: '파일 1~3개만 올리면 가장 빠르게 결과를 확인할 수 있습니다.',
                  detail: 'docker-compose / .env / Dockerfile · 총 1MB',
                },
                {
                  icon: Terminal,
                  mode: 'CLI',
                  title: 'CLI',
                  desc: '터미널 한 줄로 프로젝트를 더 깊게 검사하고 업로드할 수 있습니다.',
                  detail: 'ssafer run --upload · 로컬 마스킹 처리',
                },
                {
                  icon: Server,
                  mode: 'AGENT',
                  title: 'Local Agent',
                  desc: '서버에 연결해두면 웹에서 원격 점검과 패치 적용까지 이어집니다.',
                  detail: 'WebSocket 상시 연결 · 자동 패치 지원',
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    className="theme-dark-panel group border border-neutral-200 bg-white p-8 transition hover:bg-[#F5F5F5]"
                    key={item.mode}
                    to={ROUTES.login}
                  >
                    <div className="flex items-start justify-between">
                      <Icon className="h-8 w-8 text-neutral-400 transition group-hover:text-black" />
                      <span className="bg-black px-2 py-1 text-[10px] font-bold tracking-[0.25em] text-white">
                        {item.mode}
                      </span>
                    </div>
                    <h3 className="mt-6 text-2xl font-black tracking-tight">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-neutral-700">{item.desc}</p>
                    <p className="mt-3 font-mono text-xs text-neutral-400">{item.detail}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="theme-dark-banner mx-auto max-w-7xl px-6 py-20">
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-neutral-500">why ssafer</p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight">
            일반적인 코드 도우미와 달리
            <br />
            보안 설정 분석에 집중했습니다.
          </h2>
          <div className="mt-10 grid gap-4 lg:grid-cols-4">
            {[
              {
                icon: Hash,
                title: '고정된 룰셋',
                desc: '버전 관리되는 규칙을 기반으로 결과를 내므로 실행할 때마다 기준이 흔들리지 않습니다.',
              },
              {
                icon: Bug,
                title: '결정론적 탐지',
                desc: 'Trivy와 커스텀 룰 기반으로 분석해 설정 이슈를 안정적으로 찾습니다.',
              },
              {
                icon: Lock,
                title: '마스킹 레이어',
                desc: '.env 같은 민감 정보는 마스킹한 뒤 후속 처리 흐름으로 넘깁니다.',
              },
              {
                icon: Activity,
                title: '이력 추적',
                desc: 'scanId를 기준으로 이전 결과와 비교해 해결/증가 여부를 추적할 수 있습니다.',
              },
            ].map((item, index) => {
              const Icon = item.icon;

              return (
                <article className="theme-dark-panel border border-neutral-200 bg-white p-8" key={item.title}>
                  <Icon className="h-6 w-6 text-neutral-400" />
                  <p className="mt-6 text-xs font-bold tracking-[0.25em] text-neutral-400">0{index + 1}</p>
                  <h3 className="mt-2 text-xl font-black tracking-tight">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-neutral-600">{item.desc}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="bg-black text-white">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-16 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-neutral-500">security typing challenge</p>
              <h2 className="mt-4 text-4xl font-black tracking-tight">
                따라 치면서 익히는
                <br />
                안전한 설정 한 줄
              </h2>
              <p className="mt-4 max-w-xl text-neutral-400">
                매일 1분, 안전한 설정을 직접 입력해보세요. 손에 익으면 실수도 줄고 리뷰 속도도 빨라집니다.
              </p>
              <Link
                className="mt-8 inline-flex items-center gap-2 bg-[#3DDC84] px-6 py-3 text-sm font-bold tracking-wide text-black"
                to={ROUTES.typingGame}
              >
                <Trophy className="h-4 w-4" />
                오늘의 챌린지
              </Link>
            </div>
            <div className="flex items-center justify-end gap-5">
              <PixelGoose mood="working" size={132} />
              <div className="w-full max-w-[220px] border border-neutral-700 bg-neutral-900 p-4 font-mono text-sm">
                <div className="text-neutral-500"># type below</div>
                <div className="mt-2 text-green-400">USER node</div>
                <div className="mt-2 text-neutral-500">_</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default LandingPage;
