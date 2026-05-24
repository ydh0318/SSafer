import { motion } from 'framer-motion';
import { ArrowRight, Search } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import SiteHeader from '../../components/layout/SiteHeader';
import { FEATURE_THEME } from '../../constants/featureTheme';
import { ROUTES } from '../../constants/routes';
import useGuestEntry from '../../features/auth/hooks/useGuestEntry';
import { hasStoredMemberSession } from '../../features/auth/utils/session';
import { getHistoryScans } from '../../features/history/api/history';
import AppleHeroSection from '../../features/home/components/AppleHeroSection';
import LandingEntryModal from '../../features/home/components/LandingEntryModal';
import LoopingNumberTicker from '../../features/home/components/LoopingNumberTicker';
import ElevatorSection from '../../features/home/components/sections/ElevatorSection';
import FinalCtaCard from '../../features/home/components/sections/FinalCtaCard';
import FloorsSection from '../../features/home/components/sections/FloorsSection';
import HowItWorksSection from '../../features/home/components/sections/HowItWorksSection';
import MeetSsaferGrid from '../../features/home/components/sections/MeetSsaferGrid';
import WhySsaferSection from '../../features/home/components/sections/WhySsaferSection';
import { useForceLightTheme } from '../../features/home/hooks/useForceLightTheme';
import { useAuthStore } from '../../store/authStore';
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

const LANDING_STEPS = [
  {
    title: 'Upload Config',
    titleClassName: 'text-[#3557D6]',
    description: '\uC124\uC815 \uD30C\uC77C \uC5C5\uB85C\uB4DC\uB85C \uBE60\uB974\uAC8C \uBCF4\uC548 \uC810\uAC80\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4.',
    icon: (
      <div className="relative h-[4.6rem] w-[4.6rem]">
        <span className="absolute left-3 top-2 h-10 w-10 border-2 border-black bg-white shadow-[2px_2px_0_#d9e7fb]" />
        <span className="absolute left-4 top-3 h-2 w-8 border-2 border-black bg-[#f7f1e7]" />
        <span className="absolute left-[1.7rem] top-[0.6rem] h-3 w-3 border-2 border-black bg-white" />
        <span className="absolute left-5 top-[0.85rem] h-[2px] w-[2px] bg-black" />
        <span className="absolute left-4 top-[1.6rem] h-5 w-8 border-2 border-black bg-white" />
      </div>
    ),
  },
  {
    title: 'Detect Risks',
    titleClassName: 'text-[#C24736]',
    description: '\uC704\uD5D8\uD55C \uC124\uC815\uACFC \uCDE8\uC57D\uD55C \uAD6C\uC131 \uC694\uC18C\uB97C \uCC3E\uC544\uB0C5\uB2C8\uB2E4.',
    icon: (
      <div className="relative h-[4.6rem] w-[4.6rem]">
        <span className="absolute left-4 top-1 h-8 w-8 rotate-45 border-2 border-black bg-white shadow-[2px_2px_0_#e2ebf8]" />
        <span className="absolute left-[1.15rem] top-[0.65rem] h-8 w-8 rotate-45 border-2 border-black bg-white/95" />
        <span className="absolute left-[1.3rem] top-[1rem] h-8 w-8 rotate-45 border-2 border-black bg-[#f8f5ef]" />
        <span className="absolute left-[1.95rem] top-[1.15rem] h-4 w-4 rotate-45 border-r-2 border-t-2 border-black" />
      </div>
    ),
  },
  {
    title: 'Explain & Fix',
    titleClassName: 'text-[#7C5A12]',
    description: 'AI\uAC00 \uC6D0\uC778\uACFC \uC218\uC815 \uBC29\uD5A5\uC744 \uC27D\uAC8C \uC124\uBA85\uD574\uC90D\uB2C8\uB2E4.',
    icon: (
      <div className="relative h-[4.6rem] w-[4.6rem]">
        <span className="absolute left-2 top-4 h-5 w-3 border-2 border-black bg-white shadow-[2px_2px_0_#dce8f6]" />
        <span className="absolute left-[1.05rem] top-3 h-4 w-5 border-2 border-black bg-white" />
        <span className="absolute left-[1.65rem] top-4 h-[2px] w-3 bg-black" />
        <span className="absolute left-[2.55rem] top-[1.15rem] h-[2px] w-[2px] bg-black" />
        <span className="absolute left-[2.95rem] top-[1.65rem] h-[2px] w-[2px] bg-black" />
        <span className="absolute left-[2.55rem] top-[2.2rem] h-[2px] w-[2px] bg-black" />
        <span className="absolute left-[2.55rem] top-[1.65rem] h-[2px] w-[2px] bg-black" />
      </div>
    ),
  },
  {
    title: 'Approve & Apply',
    titleClassName: 'text-[#2F8A4A]',
    description: '\uAC80\uD1A0\uB97C \uB9C8\uCE58\uBA74 \uC548\uC804\uD558\uAC8C \uC801\uC6A9\uAE4C\uC9C0 \uC774\uC5B4\uC9D1\uB2C8\uB2E4.',
    icon: (
      <div className="relative h-[4.6rem] w-[4.6rem]">
        <span className="absolute left-[1.55rem] top-[0.55rem] h-2 w-4 border-2 border-b-0 border-black bg-white" />
        <span className="absolute left-[1.2rem] top-[1.35rem] h-8 w-8 border-2 border-black bg-white shadow-[2px_2px_0_#dceadf]" />
        <span className="absolute left-[1.9rem] top-[2.2rem] h-3 w-2 border-b-2 border-r-2 border-[#2F8A4A] rotate-45" />
      </div>
    ),
  },
] as const;

function LandingPage2() {
  useForceLightTheme();

  const navigate = useNavigate();
  const [stats, setStats] = useState<LandingStats>(initialStats);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const isTickerPaused = useEasterEggStore((state) => state.isTickerPaused);
  const { clearError, errorMessage, isPending, startGuestEntry } = useGuestEntry();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

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

  const handleIssueGuestToken = async () => {
    const succeeded = await startGuestEntry();
    return succeeded;
  };

  const handleStartUpload = async () => {
    if (!isAuthenticated) {
      const succeeded = await handleIssueGuestToken();
      if (!succeeded) return;
    }

    closeEntryModal();
    navigate(ROUTES.projects);
  };

  const handleStartCli = () => {
    closeEntryModal();
    navigate(ROUTES.guide);
  };

  const landingPromptText = `${user?.name?.trim() || 'userid'} \uB2D8\uC5D0\uAC8C \uAC00\uC7A5 \uD544\uC694\uD55C \uAE30\uB2A5\uC740 \uBB34\uC5C7\uC778\uAC00\uC694 ?`;

  return (
    <>
      <div className="theme-landing-page min-h-screen bg-[#FAF5EF] text-black" style={landingStyle}>
        <SiteHeader showSessionBar={false} variant="landing" />
        <main className="min-w-0 bg-[#FAF5EF]">
          <section className="flex min-h-[calc(100vh-88px)] flex-col bg-[#FAF5EF] px-5 pb-12 pt-6 md:px-7 md:pb-14 md:pt-8">
            <div className="flex flex-1 items-center justify-center">
              <div className="mx-auto flex w-full max-w-7xl justify-center">
                <button
                  className="flex w-full max-w-[44rem] items-center justify-between gap-4 border border-neutral-200 bg-white px-5 py-3 text-left shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-black hover:shadow-[0_22px_46px_rgba(15,23,42,0.10)]"
                  onClick={openEntryModal}
                  type="button"
                >
                  <span className="min-w-0 truncate text-sm font-light tracking-[-0.01em] text-black md:text-[1.4rem]">
                    {landingPromptText}
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center text-black">
                    <Search className="h-6 w-6 stroke-[1.75]" />
                  </span>
                </button>
              </div>
            </div>

            <div className="mx-auto mt-10 grid w-full max-w-7xl gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-4">
              {LANDING_STEPS.map((step) => (
                <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-4" key={step.title}>
                  <div className="flex min-h-[80px] w-[72px] flex-wrap content-start items-end gap-2 pt-1">
                    {step.icon}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-mono text-[1.55rem] leading-none tracking-[-0.025em] md:text-[1.8rem] ${step.titleClassName}`}>
                      {step.title}
                    </p>
                    <p className="mt-2.5 max-w-[230px] text-[0.92rem] leading-6 text-neutral-600">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <AppleHeroSection bottomFadeColor="#FAFAF7" showHeader={false} />

          <section>
            <div className="mx-auto max-w-[1160px] px-5 pb-14 pt-8 md:px-7 md:pb-16 md:pt-11">
              <motion.div
                className="text-[10px] font-mono tracking-[0.42em] text-neutral-400"
                initial={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                viewport={{ amount: 0.4, once: false }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                MEET SSAFER
              </motion.div>

              <div className="mt-6">
                <motion.h1
                  className="text-5xl font-black leading-[0.9] text-[var(--landing-ink)] md:text-7xl xl:text-[6.4rem]"
                  initial={{ opacity: 0, y: -48 }}
                  transition={{ delay: 0.08, type: 'spring', stiffness: 90, damping: 14 }}
                  viewport={{ amount: 0.3, once: false }}
                  whileInView={{ opacity: 1, y: 0 }}
                >
                  {'\uCDE8\uC57D\uC810,'}
                </motion.h1>

                <div className="mt-2 grid gap-2 xl:grid-cols-[auto_auto_minmax(0,1fr)] xl:items-end xl:gap-6">
                  <motion.div
                    className="text-5xl font-black leading-[0.9] text-[var(--landing-ink)] md:text-7xl xl:text-[6.4rem]"
                    initial={{ opacity: 0, x: -32 }}
                    transition={{ delay: 0.22, type: 'spring', stiffness: 110, damping: 18 }}
                    viewport={{ amount: 0.3, once: false }}
                  whileInView={{ opacity: 1, x: 0 }}
                >
                    {'\uC9C0\uAE08'}
                  </motion.div>
                  <motion.div
                    className="landing-inner-radius inline-flex h-[0.9em] w-[4.8ch] items-center justify-center bg-[var(--landing-accent)] px-3 text-5xl font-black leading-none text-[var(--landing-ink)] md:text-7xl xl:text-[6.4rem]"
                    initial={{ opacity: 0, scale: 0.6, rotate: -6 }}
                    transition={{ delay: 0.34, type: 'spring', stiffness: 220, damping: 12 }}
                    viewport={{ amount: 0.3, once: false }}
                    whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                  >
                    <LoopingNumberTicker durationMs={6500} edgeHoldMs={800} paused={isTickerPaused} to={5000} />
                  </motion.div>
                  <motion.div
                    className="text-4xl font-black leading-none text-neutral-500 md:text-6xl xl:text-[4.5rem]"
                    initial={{ opacity: 0, x: 32 }}
                    transition={{ delay: 0.48, type: 'spring', stiffness: 110, damping: 18 }}
                    viewport={{ amount: 0.3, once: false }}
                  whileInView={{ opacity: 1, x: 0 }}
                >
                    {'\uAC1C \uBC1C\uACAC\uB428'}
                  </motion.div>
                </div>
              </div>

              <motion.p
                className="mt-7 max-w-md text-sm leading-relaxed text-neutral-700 md:text-base"
                initial={{ opacity: 0, y: 12 }}
                transition={{ delay: 0.6, duration: 0.45, ease: 'easeOut' }}
                viewport={{ amount: 0.3, once: false }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                {'docker-compose, .env, sshd_config.'}
                <br />
                {'\uC62C\uB9AC\uBA74 \uC54C\uB824\uB4DC\uB824\uC694. 30\uCD08 \uC548\uC5D0.'}
              </motion.p>

              <motion.div
                className="mt-7 flex flex-wrap items-center gap-3"
                initial={{ opacity: 0, y: 12 }}
                transition={{ delay: 0.72, duration: 0.45, ease: 'easeOut' }}
                viewport={{ amount: 0.3, once: false }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <button
                  className="landing-inner-radius inline-flex h-11 items-center gap-2 bg-[#111111] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:opacity-90 hover:shadow-[0_14px_30px_rgba(0,0,0,0.18)] active:translate-y-0"
                  onClick={openEntryModal}
                  type="button"
                >
                  {'\uC9C0\uAE08 \uD574\uBCF4\uAE30'}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
                <Link className="inline-flex h-11 items-center gap-2 px-3 text-sm text-neutral-600 transition hover:text-black" to={ROUTES.guide}>
                  {'CLI \uAE54\uAE30 \u2192'}
                </Link>
              </motion.div>
            </div>
          </section>

          <MeetSsaferGrid
            activeMonth={stats.activeMonth}
            criticalCount={formattedStats.criticalCount}
            findingCount={formattedStats.findingCount}
            scanCount={formattedStats.scanCount}
          />

          <ElevatorSection />
          <FloorsSection />
          <WhySsaferSection />
          <HowItWorksSection />
          <FinalCtaCard onOpenEntry={openEntryModal} />
        </main>

        {isEntryModalOpen ? (
          <LandingEntryModal
            errorMessage={errorMessage}
            isGuestPending={isPending}
            onClose={closeEntryModal}
            onIssueGuestToken={() => void handleIssueGuestToken()}
            onStartCli={handleStartCli}
            onStartUpload={() => void handleStartUpload()}
          />
        ) : null}
      </div>
    </>
  );
}

export default LandingPage2;
