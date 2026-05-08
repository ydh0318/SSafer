import { ArrowRight, ArrowUpRight, FolderUp, Server, Terminal } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import FeatureInfoCard from '../../components/common/FeatureInfoCard';
import PixelGoose from '../../components/common/PixelGoose';
import SiteHeader from '../../components/layout/SiteHeader';
import { FEATURE_THEME } from '../../constants/featureTheme';
import { ROUTES } from '../../constants/routes';
import useGuestEntry from '../../features/auth/hooks/useGuestEntry';
import { hasStoredMemberSession } from '../../features/auth/utils/session';
import LandingEntryModal from '../../features/home/components/LandingEntryModal';
import LoopingNumberTicker from '../../features/home/components/LoopingNumberTicker';
import { getHistoryScans } from '../../features/history/api/history';
import HomeFeatureCard from '../../features/home/components/HomeFeatureCard';

type ComparisonItem = {
  step: string;
  title: ReactNode;
  description: string;
  titleClassName?: string;
};

const comparisonItems: ComparisonItem[] = [
  {
    step: '01',
    title: (
      <>
        설정 파일
        <br />
        업로드
      </>
    ),
    description: 'docker-compose, .env, nginx, sshd_config 같은 설정 파일을 올리면 현재 위험 포인트를 빠르게 훑어줍니다.',
  },
  {
    step: '02',
    title: (
      <>
        위험 포인트
        <br />
        식별
      </>
    ),
    description: '누락된 보안 설정, 과도한 권한, 외부 노출 가능성이 있는 항목들을 먼저 정리해서 보여줍니다.',
  },
  {
    step: '03',
    title: (
      <>
        AI 설명과
        <br />
        수정안
      </>
    ),
    description: '왜 위험한지와 어떤 식으로 고쳐야 하는지까지 한 번에 읽히는 형태로 바꿔줍니다.',
  },
  {
    step: '04',
    title: '팀과 공유 가능한 결과',
    titleClassName: 'break-keep',
    description: 'scanId 기준으로 결과를 남기고 팀원이 같은 화면을 보며 바로 다음 작업을 이어갈 수 있습니다.',
  },
];

const flowItems = [
  '01 파일 선택',
  '02 프로젝트 선택',
  '03 스캔 요청',
  '04 업로드 완료',
  '05 AI 분석',
  '06 결과 확인',
  '07 위험 우선순위 정리',
  '08 패치 제안 검토',
  '09 수정 적용 검토',
  '10 재점검',
  '11 팀과 공유',
] as const;

const landingStyle = {
  '--landing-accent': FEATURE_THEME.lime,
  '--landing-ink': FEATURE_THEME.ink,
} as CSSProperties;

type LandingStats = {
  activeMonth: string;
  patchCount: number;
  scanCount: number;
  userCount: number;
};

const initialStats: LandingStats = {
  activeMonth: new Date().toISOString().slice(0, 7),
  patchCount: 0,
  scanCount: 0,
  userCount: 0,
};

function LandingPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<LandingStats>(initialStats);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const { clearError, errorMessage, isPending, startGuestEntry } = useGuestEntry();

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
          activeMonth: new Date().toISOString().slice(0, 7),
          patchCount: 0,
          scanCount: historyData.summary.totalScanCount ?? 0,
          userCount: 0,
        });
      } catch (error) {
        console.error('Failed to load landing stats.', error);

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
      patchCount: stats.patchCount.toLocaleString('ko-KR'),
      scanCount: stats.scanCount.toLocaleString('ko-KR'),
      userCount: stats.userCount.toLocaleString('ko-KR'),
    }),
    [stats.patchCount, stats.scanCount, stats.userCount],
  );

  const openEntryModal = () => {
    clearError();
    setIsEntryModalOpen(true);
  };

  const closeEntryModal = () => {
    clearError();
    setIsEntryModalOpen(false);
  };

  const handleGuestStart = async () => {
    const succeeded = await startGuestEntry();

    if (succeeded) {
      closeEntryModal();
      navigate(ROUTES.projects);
    }
  };

  return (
    <div className="site-shell-with-nav theme-landing-page min-h-screen bg-[#FAFAF7] text-black" style={landingStyle}>
      <SiteHeader showSessionBar={false} />

      <main className="site-shell-main min-w-0 flex-1 bg-[#FAFAF7]">
        <section className="border-b border-black/5">
          <div className="mx-auto max-w-[1160px] px-5 pb-14 pt-8 md:px-7 md:pb-16 md:pt-11">
            <div className="text-[10px] font-mono tracking-[0.42em] text-neutral-400">MEET SSAFER</div>

            <div className="mt-6">
              <h1 className="text-5xl font-black leading-[0.9] text-[var(--landing-ink)] md:text-7xl xl:text-[6.4rem]">취약점,</h1>

              <div className="mt-2 grid gap-2 xl:grid-cols-[auto_auto_minmax(0,1fr)] xl:items-end xl:gap-6">
                <div className="text-5xl font-black leading-[0.9] text-[var(--landing-ink)] md:text-7xl xl:text-[6.4rem]">지금</div>
                <div className="inline-flex h-[0.9em] w-[4.8ch] items-center justify-center bg-[var(--landing-accent)] px-3 text-5xl font-black leading-none text-[var(--landing-ink)] md:text-7xl xl:text-[6.4rem]">
                  <LoopingNumberTicker durationMs={2500} edgeHoldMs={320} to={5000} />
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
              <button
                className="inline-flex h-11 items-center gap-2 bg-[#111111] px-5 text-sm font-bold text-white transition hover:opacity-90"
                onClick={openEntryModal}
                type="button"
              >
                지금 해보기
                <ArrowRight className="h-4 w-4" />
              </button>
              <Link className="inline-flex h-11 items-center gap-2 px-3 text-sm text-neutral-600 transition hover:text-black" to={ROUTES.guide}>
                CLI 깔기 →
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1160px] px-5 pb-10 pt-3 md:px-7">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
            <FeatureInfoCard
              className="relative min-h-[320px] overflow-hidden xl:col-span-7 xl:row-span-2"
              description="코드를 같이 봐드려요. 친구는 아니고, 그냥 거위."
              eyebrow="MEET SSAFE"
              footer={
                <div className="flex items-end justify-between gap-6">
                  <div className="rounded-[2rem] border border-white/12 bg-[linear-gradient(135deg,#fffef7_0%,#fff6cf_100%)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
                    <PixelGoose mood="happy" size={132} />
                  </div>
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
              title={<div className="text-xl font-black md:text-[2rem]">웹·CLI·서버</div>}
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
            <div className="text-xs font-mono text-neutral-400">{stats.activeMonth} 기준 집계</div>
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
          <div className="text-3xl font-black tracking-tight md:text-4xl">복잡한 운영 보안도 흐름은 단순하게</div>
          <div className="mt-7 grid gap-3 xl:grid-cols-4">
            {comparisonItems.map((item) => (
              <HomeFeatureCard
                description={item.description}
                key={item.step}
                step={item.step}
                title={item.title}
                titleClassName={item.titleClassName}
              />
            ))}
          </div>
        </section>
      </main>

      {isEntryModalOpen ? (
        <LandingEntryModal
          errorMessage={errorMessage}
          isGuestPending={isPending}
          onClose={closeEntryModal}
          onContinueAsGuest={() => void handleGuestStart()}
          onLogin={() => navigate(ROUTES.login)}
        />
      ) : null}
    </div>
  );
}

export default LandingPage;
