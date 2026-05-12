import { Globe, Terminal, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import PixelGoose from '../../components/common/PixelGoose';
import { ROUTES } from '../../constants/routes';
import { useAuthStore } from '../../store/authStore';

export default function WelcomePage() {
  const [step, setStep] = useState<1 | 2>(1);
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

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
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#1A1A1A] px-4 py-12 font-sans text-white">
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
                className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-[#D4FC64] px-8 text-lg font-black text-black shadow-[0_0_32px_rgba(212,252,100,0.25)] transition-transform hover:scale-105 active:scale-95"
                onClick={() => setStep(2)}
                type="button"
              >
                시작하기 <ArrowRight className="h-5 w-5 stroke-[3]" />
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
          className={`mx-auto flex max-w-[800px] flex-col justify-center p-4 transition-all duration-700 md:p-10 ${
            step === 2
              ? 'relative translate-x-0 opacity-100 pointer-events-auto'
              : 'absolute inset-0 translate-x-10 opacity-0 pointer-events-none'
          }`}
        >
          <div className="text-left">
            <p className="font-mono text-xs font-bold tracking-[0.3em] text-neutral-500">START SSAFER</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-white">어떤 방식으로 시작할까요?</h2>
            <p className="mt-4 max-w-2xl text-base text-neutral-400">
              터미널에서 바로 쓰고 싶다면 CLI로, 브라우저에서 파일을 올려 확인하고 싶다면 Web으로 시작하세요.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {/* CLI Card */}
            <button
              className="group flex flex-col justify-between rounded-[32px] border border-neutral-800 bg-[#222] p-8 text-left transition-all hover:border-neutral-600 hover:bg-[#2A2A2A]"
              onClick={handleCliClick}
              type="button"
            >
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#333] text-[#D4FC64] group-hover:bg-[#444]">
                  <Terminal className="h-6 w-6" />
                </div>
                <h3 className="mt-8 text-2xl font-black text-white">CLI로 시작하기</h3>
                <p className="mt-4 text-sm leading-relaxed text-neutral-400">
                  터미널에서 설정 파일을 바로 스캔합니다. CI/CD 파이프라인 연동에도 적합합니다.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-sm font-bold text-[#D4FC64]">
                설치 가이드 보기 <ArrowRight className="h-4 w-4" />
              </div>
            </button>

            {/* Web Card */}
            <button
              className="group flex flex-col justify-between rounded-[32px] bg-[#D4FC64] p-8 text-left transition-all hover:brightness-105"
              onClick={handleWebClick}
              type="button"
            >
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-black/10 bg-black/5 text-black">
                  <Globe className="h-6 w-6" />
                </div>
                <h3 className="mt-8 text-2xl font-black text-black">Web으로 시작하기</h3>
                <p className="mt-4 text-sm leading-relaxed text-black/70">
                  브라우저에서 설정 파일을 업로드하고 결과를 바로 확인합니다. 설치 없이 즉시 사용 가능합니다.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-sm font-bold text-black">
                웹에서 바로 시작 <ArrowRight className="h-4 w-4" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
