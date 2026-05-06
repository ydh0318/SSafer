import { ArrowRight, ArrowUpRight, FolderUp, Server, Terminal } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import FeatureInfoCard from '../../components/common/FeatureInfoCard';
import PixelGoose from '../../components/common/PixelGoose';
import SiteHeader from '../../components/layout/SiteHeader';
import { FEATURE_THEME } from '../../constants/featureTheme';
import { ROUTES } from '../../constants/routes';
import { hasStoredMemberSession } from '../../features/auth/utils/session';
import LoopingNumberTicker from '../../features/home/components/LoopingNumberTicker';
import { getHistoryScans } from '../../features/history/api/history';
import HomeFeatureCard from '../../features/home/components/HomeFeatureCard';

const comparisonItems = [
  { step: '01', title: '룰 고정', description: '버전 박힌 룰셋. LLM마다 결과 안 흔들려요.' },
  { step: '02', title: '안 지어내요', description: '결정론적 탐지. 할루시네이션 0.' },
  { step: '03', title: '비밀 안 새요', description: '.env 원본은 외부로 안 나가요.' },
  { step: '04', title: '기록돼요', description: 'scanId로 비교하고 추적합니다.' },
] as const;

const flowItems = [
  '01 랜딩',
  '02 새 스캔',
  '03 진행',
  '04 대시보드',
  '05 결과',
  '06 상세',
  '07 히스토리',
  '08 모니터',
  '09 가이드',
  '10 설정',
  '11 챌린지',
] as const;

const landingStyle = {
  '--landing-accent': FEATURE_THEME.lime,
  '--landing-ink': FEATURE_THEME.ink,
} as CSSProperties;

type LandingStats = {
  userCount: number;
  scanCount: number;
  patchCount: number;
  기준Month: string;
};

const initialStats: LandingStats = {
  userCount: 0,
  scanCount: 0,
  patchCount: 0,
  기준Month: new Date().toISOString().slice(0, 7),
};

function LandingPage() {
  const [stats, setStats] = useState<LandingStats>(initialStats);

  useEffect(() => {
    let isMounted = true;

    const loadLandingStats = async () => {
      if (!hasStoredMemberSession()) {
        if (isMounted) {
          setStats(initialStats);
        }
        return;
      }

      try {
        const historyData = await getHistoryScans({ page: 0, size: 1 });

        if (!isMounted) {
          return;
        }

        setStats({
          userCount: 0,
          scanCount: historyData.summary.totalScanCount ?? 0,
          patchCount: 0,
          기준Month: new Date().toISOString().slice(0, 7),
        });
      } catch {
        if (isMounted) {
          setStats(initialStats);
        }
      }
    };

    void loadLandingStats();

    return () => {
      isMounted = false;
    };
  }, []);

  const formattedStats = useMemo(
    () => ({
      userCount: stats.userCount.toLocaleString('ko-KR'),
      scanCount: stats.scanCount.toLocaleString('ko-KR'),
      patchCount: stats.patchCount.toLocaleString('ko-KR'),
    }),
    [stats.patchCount, stats.scanCount, stats.userCount],
  );

  return (
    <div className="site-shell-with-nav theme-landing-page min-h-screen bg-[#FAFAF7] text-black" style={landingStyle}>
      <SiteHeader showSessionBar={false} />

      <main className="site-shell-main min-w-0 flex-1 bg-[#FAFAF7]">
        <section className="theme-landing-hero border-b border-black/5">
          <div className="mx-auto max-w-[1160px] px-5 pb-11 pt-8 md:px-7 md:pb-16 md:pt-11">
            <div className="text-[10px] font-mono tracking-[0.42em] text-neutral-400">MEET SSAFER</div>

            <div className="mt-6">
              <h1 className="text-5xl font-black leading-[0.9] text-[var(--landing-ink)] md:text-7xl xl:text-[6.4rem]">
                취약점,
              </h1>

              <div className="mt-2 grid gap-2 xl:grid-cols-[auto_auto_minmax(0,1fr)] xl:items-end xl:gap-6">
                <div className="theme-landing-now text-5xl font-black leading-[0.9] text-[var(--landing-ink)] md:text-7xl xl:text-[6.4rem]">
                  지금
                </div>
                <div className="inline-flex h-[0.9em] w-[4.8ch] items-center justify-center bg-[var(--landing-accent)] px-3 text-5xl font-black leading-none text-[var(--landing-ink)] md:text-7xl xl:text-[6.4rem]">
                  <LoopingNumberTicker durationMs={1240} edgeHoldMs={210} to={5000} />
                </div>
                <div className="text-4xl font-black leading-none text-neutral-500 md:text-6xl xl:text-[4.5rem]">개 발견됨</div>
              </div>
            </div>

            <p className="mt-7 max-w-md text-sm leading-relaxed text-neutral-700 md:text-base">
              docker-compose, .env, sshd_config.
              <br />
              올리면 알려드려요. 30초 안에.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                className="inline-flex h-11 items-center gap-2 bg-[#111111] px-5 text-sm font-bold text-white transition hover:opacity-90"
                to={ROUTES.login}
              >
                지금 해보기
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link className="inline-flex h-11 items-center gap-2 px-3 text-sm text-neutral-600 transition hover:text-black" to={ROUTES.guide}>
                CLI 깔기
                <span className="font-mono">→</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1160px] px-5 pb-10 pt-3 md:px-7">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
            <FeatureInfoCard
              className="relative min-h-[320px] overflow-hidden xl:col-span-7 xl:row-span-2"
              description="코드를 같이 봐드려요. 친구는 아니고, 그냥 보안 거위."
              eyebrow="MEET SSAFER"
              footer={
                <div className="flex items-end justify-between gap-6">
                  <PixelGoose mood="happy" size={132} />
                  <Link className="inline-flex items-center gap-2 text-xs text-neutral-400 transition hover:text-white" to={ROUTES.typingGame}>
                    연습하러
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              }
              title={
                <div className="text-2xl font-black leading-tight md:text-3xl">
                  저예요.
                  <br />
                  보안 거위 <span className="text-[var(--landing-accent)]">SSAFER</span>.
                </div>
              }
              tone="dark"
            />

            <FeatureInfoCard
              className="xl:col-span-5"
              description="파일 3개 기준 P95"
              eyebrow="평균 검사 시간"
              title={
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black tabular-nums">28</span>
                  <span className="text-xl font-bold text-neutral-300">초</span>
                </div>
              }
            />

            <FeatureInfoCard
              className="xl:col-span-5"
              eyebrow="3가지 방식"
              footer={
                <div className="flex items-center gap-2 text-xs">
                  <FolderUp className="h-4 w-4" />
                  <Terminal className="h-4 w-4" />
                  <Server className="h-4 w-4" />
                  <span className="ml-auto text-neutral-700">골라서 시작</span>
                </div>
              }
              title={<div className="text-xl font-black">웹·CLI·서버</div>}
              tone="accent"
            />
          </div>

          <section className="theme-dark-soft-card mt-3 flex flex-col gap-5 bg-white px-7 py-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-8">
              <div>
                <div className="mb-1 text-[10px] font-mono tracking-widest text-neutral-400">사용자</div>
                <div className="text-xl font-black tabular-nums">{formattedStats.userCount}</div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-mono tracking-widest text-neutral-400">스캔</div>
                <div className="text-xl font-black tabular-nums">{formattedStats.scanCount}</div>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-mono tracking-widest text-neutral-400">패치 적용</div>
                <div className="text-xl font-black tabular-nums">{formattedStats.patchCount}</div>
              </div>
            </div>
            <div className="text-xs font-mono text-neutral-400">{stats.기준Month} 기준</div>
          </section>

          <div className="mx-auto mt-3 max-w-3xl bg-[#111111] px-4 py-3 shadow-2xl">
            <div className="flex flex-wrap items-center gap-1">
              {flowItems.map((item, index) => (
                <span
                  className={`px-2 py-1.5 text-[10px] ${index === 0 ? 'bg-[var(--landing-accent)] font-bold text-black' : 'text-neutral-400'}`}
                  key={item}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1160px] px-5 pb-20 pt-6 md:px-7">
          <div className="text-3xl font-black tracking-tight md:text-4xl">Cursor랑 뭐가 달라요?</div>
          <div className="mt-7 grid gap-3 xl:grid-cols-4">
            {comparisonItems.map((item) => (
              <HomeFeatureCard description={item.description} key={item.step} step={item.step} title={item.title} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default LandingPage;
