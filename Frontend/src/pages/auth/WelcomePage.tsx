import { ArrowRight, Check, Copy, Eye, EyeOff, Globe, LoaderCircle,Terminal } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import useGuestEntry from '../../features/auth/hooks/useGuestEntry';
import { useAuthStore } from '../../store/authStore';

export default function WelcomePage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const accessToken = useAuthStore((state) => state.accessToken);
  const { isPending: isGuestPending, startGuestEntry } = useGuestEntry();

  // 게스트 세션: 인증됨 + refreshToken 없음 (게스트는 refresh token을 발급받지 않음)
  const isGuest = isAuthenticated && !refreshToken;

  const handleStart = async () => {
    if (!isAuthenticated) {
      const succeeded = await startGuestEntry();
      if (!succeeded) return;
    }
    setStep(2);
  };

  const handleCopyCommand = async () => {
    if (!accessToken) return;
    await navigator.clipboard.writeText(`ssafer login --guest-token ${accessToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCliClick = () => {
    navigate(ROUTES.guide);
  };

  const handleWebClick = () => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || ROUTES.projects;
      navigate(from, { replace: true });
    } else {
      navigate(ROUTES.login, { state: location.state, replace: true });
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#1A1A1A] px-4 py-4 font-sans text-white">
      <div className="relative w-full max-w-[1100px]">
        {/* Step 1 */}
        <div
          className={`mx-auto flex max-w-[1000px] flex-col items-center justify-center p-4 transition-all duration-700 md:flex-row md:p-12 ${
            step === 1
              ? 'relative translate-x-0 opacity-100 pointer-events-auto'
              : 'absolute inset-0 -translate-x-10 opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex h-[320px] w-[320px] shrink-0 items-center justify-center rounded-[40px] bg-white shadow-inner">
            <PixelGoose mood="idle" size={200} />
          </div>

          <div className="mt-10 flex min-w-0 flex-col justify-center text-left md:ml-20 md:mt-0">
            <p className="font-mono text-[11px] font-bold tracking-[0.3em] text-neutral-500">MEET SSAFER</p>
            <h2 className="mt-4 whitespace-nowrap text-[4.5rem] font-black leading-[1.1] tracking-[-0.04em] text-white [text-shadow:0_0_1px_rgba(255,255,255,0.5)]">
              저예요.<br />보안 거위 <span className="text-[#D4FC64] [text-shadow:0_0_1px_rgba(212,252,100,0.5)]">SSAFER.</span>
            </h2>
            <p className="mt-8 text-[17px] leading-[1.6] text-neutral-400">
              코드를 같이 봐드려요.<br />
              친구는 아니고, 그냥 거위.
            </p>

            <div className="mt-12 flex items-center gap-4 whitespace-nowrap">
              <button
                className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-[#D4FC64] px-8 text-lg font-black text-black shadow-[0_0_32px_rgba(212,252,100,0.25)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                disabled={isGuestPending}
                onClick={() => void handleStart()}
                type="button"
              >
                {isGuestPending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5 stroke-[3]" />}
                시작하기
              </button>
              <button
                className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-neutral-700 bg-transparent px-8 text-lg font-bold text-white transition-colors hover:bg-neutral-800"
                onClick={() => navigate(ROUTES.login)}
                type="button"
              >
                로그인 하러 가기
              </button>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div
          className={`mx-auto flex max-w-[860px] flex-col justify-center p-4 transition-all duration-700 md:p-8 ${
            step === 2
              ? 'relative translate-x-0 opacity-100 pointer-events-auto'
              : 'absolute inset-0 translate-x-10 opacity-0 pointer-events-none'
          }`}
        >
          <div className="text-left">
            <p className="font-mono text-xs font-bold tracking-[0.3em] text-neutral-500">START SSAFER</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white">어떤 방식으로 시작할까요?</h2>
            <p className="mt-3 max-w-2xl text-sm text-neutral-400">
              터미널에서 바로 쓰고 싶다면 CLI로, 브라우저에서 파일을 올려 확인하고 싶다면 Web으로 시작하세요.
            </p>
          </div>

          <div className="mt-7 grid gap-5 md:grid-cols-2">
            {/* CLI Card */}
            <button
              className="group flex flex-col justify-between rounded-[28px] border border-neutral-800 bg-[#222] p-7 text-left transition-all hover:border-neutral-600 hover:bg-[#2A2A2A]"
              onClick={handleCliClick}
              type="button"
            >
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#333] text-[#D4FC64] group-hover:bg-[#444]">
                  <Terminal className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-black text-white">CLI로 시작하기</h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                  터미널에서 설정 파일을 바로 스캔합니다. CI/CD 파이프라인 연동에도 적합합니다.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-sm font-bold text-[#D4FC64]">
                설치 가이드 보기 <ArrowRight className="h-4 w-4" />
              </div>
            </button>

            {/* Web Card */}
            <button
              className="group flex flex-col justify-between rounded-[28px] bg-[#D4FC64] p-7 text-left transition-all hover:brightness-105"
              onClick={handleWebClick}
              type="button"
            >
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-black/5 text-black">
                  <Globe className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-black text-black">Web으로 시작하기</h3>
                <p className="mt-3 text-sm leading-relaxed text-black/70">
                  브라우저에서 설정 파일을 업로드하고 결과를 바로 확인합니다. 설치 없이 즉시 사용 가능합니다.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-sm font-bold text-black">
                웹에서 바로 시작 <ArrowRight className="h-4 w-4" />
              </div>
            </button>
          </div>

          {/* 게스트 세션 CLI 연동 — 게스트 사용자에게만 표시 */}
          {isGuest && (
            <div className="mt-5 rounded-2xl border border-neutral-700 bg-[#1E1E1E] p-5">
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
                  onClick={handleCopyCommand}
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
      </div>
    </div>
  );
}
