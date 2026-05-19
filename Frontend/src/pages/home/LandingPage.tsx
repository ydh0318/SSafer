import { ArrowRight } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { FEATURE_THEME } from '../../constants/featureTheme';
import { ROUTES } from '../../constants/routes';
import useGuestEntry from '../../features/auth/hooks/useGuestEntry';
import { hasStoredMemberSession } from '../../features/auth/utils/session';
import { getHistoryScans } from '../../features/history/api/history';
import AppleHeroSection from '../../features/home/components/AppleHeroSection';
import LandingEntryModal from '../../features/home/components/LandingEntryModal';
import LoopingNumberTicker from '../../features/home/components/LoopingNumberTicker';
import FinalCtaCard from '../../features/home/components/sections/FinalCtaCard';
import HowItWorksSection from '../../features/home/components/sections/HowItWorksSection';
import MeetSsaferGrid from '../../features/home/components/sections/MeetSsaferGrid';
import WhySsaferSection from '../../features/home/components/sections/WhySsaferSection';
import { useEasterEggStore } from '../../store/easterEggStore';

const landingStyle = {
  '--landing-accent': FEATURE_THEME.lime,
  '--landing-ink': FEATURE_THEME.ink,
} as CSSProperties;

type LandingStats = {
  activeMonth: string;
  scanCount: number;
  findingCount: number;
  criticalCount: number;
};

const initialStats: LandingStats = {
  activeMonth: new Date().toISOString().slice(0, 7),
  scanCount: 0,
  findingCount: 0,
  criticalCount: 0,
};

function LandingPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<LandingStats>(initialStats);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const isTickerPaused = useEasterEggStore((state) => state.isTickerPaused);
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
          scanCount: historyData.summary.totalScanCount ?? 0,
          findingCount: historyData.summary.totalFindingCount ?? 0,
          criticalCount: historyData.summary.criticalCount ?? 0,
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
      scanCount: stats.scanCount.toLocaleString('ko-KR'),
      findingCount: stats.findingCount.toLocaleString('ko-KR'),
      criticalCount: stats.criticalCount.toLocaleString('ko-KR'),
    }),
    [stats.scanCount, stats.findingCount, stats.criticalCount],
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
      navigate(ROUTES.welcome);
    }
  };

  return (
    <>
      {/* 최상단 — LandingPage2의 Section 1 (사과) 복제 */}
      <AppleHeroSection />

      <div className="site-shell-with-nav theme-landing-page min-h-screen bg-[#FAFAF7] text-black" style={landingStyle}>
        <main className="site-shell-main min-w-0 flex-1 bg-[#FAFAF7]">
        {/* ---------- HERO (고정) ---------- */}
        <section>
          <div className="mx-auto max-w-[1160px] px-5 pb-14 pt-8 md:px-7 md:pb-16 md:pt-11">
            <div className="text-[10px] font-mono tracking-[0.42em] text-neutral-400">MEET SSAFER</div>

            <div className="mt-6">
              <h1 className="text-5xl font-black leading-[0.9] text-[var(--landing-ink)] md:text-7xl xl:text-[6.4rem]">
                취약점,
              </h1>

              <div className="mt-2 grid gap-2 xl:grid-cols-[auto_auto_minmax(0,1fr)] xl:items-end xl:gap-6">
                <div className="text-5xl font-black leading-[0.9] text-[var(--landing-ink)] md:text-7xl xl:text-[6.4rem]">
                  지금
                </div>
                <div className="landing-inner-radius inline-flex h-[0.9em] w-[4.8ch] items-center justify-center bg-[var(--landing-accent)] px-3 text-5xl font-black leading-none text-[var(--landing-ink)] md:text-7xl xl:text-[6.4rem]">
                  <LoopingNumberTicker durationMs={6500} edgeHoldMs={800} paused={isTickerPaused} to={5000} />
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
                className="landing-inner-radius inline-flex h-11 items-center gap-2 bg-[#111111] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:opacity-90 hover:shadow-[0_14px_30px_rgba(0,0,0,0.18)] active:translate-y-0"
                onClick={openEntryModal}
                type="button"
              >
                지금 해보기
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
              <Link className="inline-flex h-11 items-center gap-2 px-3 text-sm text-neutral-600 transition hover:text-black" to={ROUTES.guide}>
                CLI 깔기 →
              </Link>
            </div>
          </div>
        </section>

        {/* ---------- 아래는 새 디자인 ---------- */}
        <MeetSsaferGrid
          activeMonth={stats.activeMonth}
          criticalCount={formattedStats.criticalCount}
          findingCount={formattedStats.findingCount}
          scanCount={formattedStats.scanCount}
        />

        <WhySsaferSection />

        <HowItWorksSection />

        <FinalCtaCard onOpenEntry={openEntryModal} />
      </main>

        {isEntryModalOpen ? (
          <LandingEntryModal
            errorMessage={errorMessage}
            isGuestPending={isPending}
            onClose={closeEntryModal}
            onContinueAsGuest={() => void handleGuestStart()}
            onLogin={() => navigate(ROUTES.welcome)}
          />
        ) : null}
      </div>
    </>
  );
}

export default LandingPage;
