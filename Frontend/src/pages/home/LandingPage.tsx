import { Search } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import SiteHeader from '../../components/layout/SiteHeader';
import { FEATURE_THEME } from '../../constants/featureTheme';
import { ROUTES } from '../../constants/routes';
import useGuestEntry from '../../features/auth/hooks/useGuestEntry';
import LandingEntryModal from '../../features/home/components/LandingEntryModal';
import { useForceLightTheme } from '../../features/home/hooks/useForceLightTheme';
import { useAuthStore } from '../../store/authStore';

const landingStyle = {
  '--landing-accent': FEATURE_THEME.lime,
  '--landing-ink': FEATURE_THEME.ink,
} as CSSProperties;

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

function LandingPage() {
  useForceLightTheme();

  const navigate = useNavigate();
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const { clearError, errorMessage, isPending, startGuestEntry } = useGuestEntry();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

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

export default LandingPage;
