import { Globe, Terminal, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PixelGoose from '../../../components/common/PixelGoose';
import { ROUTES } from '../../../constants/routes';

type WelcomeModalProps = {
  onClose: () => void;
};

export default function WelcomeModal({ onClose }: WelcomeModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const navigate = useNavigate();

  const handleClose = () => {
    localStorage.setItem('hasSeenWelcome_v2', 'true');
    onClose();
  };

  const handleCliClick = () => {
    handleClose();
    navigate(ROUTES.guide);
  };

  const handleWebClick = () => {
    handleClose();
    // 웹에서 시작하기는 모달을 닫고 ProjectListPage 본연의 기능을 쓰면 됨
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm transition-all duration-500">
      <div className="relative w-full max-w-[800px] overflow-hidden rounded-3xl bg-[#1A1A1A] shadow-2xl">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute right-6 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-110"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative min-h-[400px]">
          {/* Step 1 */}
          <div
            className={`absolute inset-0 flex flex-col md:flex-row items-center justify-center p-12 transition-all duration-700 ${
              step === 1 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'
            }`}
          >
            <div className="flex w-full max-w-[300px] shrink-0 items-center justify-center rounded-[40px] bg-white p-12 shadow-inner">
              <PixelGoose mood="idle" size={120} />
            </div>
            
            <div className="mt-10 md:mt-0 md:ml-16 flex flex-col justify-center text-left">
              <p className="font-mono text-xs font-bold tracking-[0.3em] text-neutral-500">MEET SSAFER</p>
              <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
                저예요.<br />보안 거위 <span className="text-[#D4FC64]">SSAFER.</span>
              </h2>
              <p className="mt-6 text-base text-neutral-400">
                코드를 같이 봐드려요.<br />
                친구는 아니고, 그냥 거위.
              </p>
              
              <button
                onClick={() => setStep(2)}
                className="mt-10 inline-flex w-fit items-center gap-2 rounded-full bg-[#D4FC64] px-8 py-4 text-base font-black text-black transition-transform hover:scale-105 active:scale-95"
              >
                시작하기 <ArrowRightIcon />
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div
            className={`absolute inset-0 flex flex-col justify-center p-10 transition-all duration-700 ${
              step === 2 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'
            }`}
          >
            <div className="text-left">
              <p className="font-mono text-xs font-bold tracking-[0.3em] text-neutral-500">START SSAFER</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight text-white">어떤 방식으로 시작할까요?</h2>
              <p className="mt-4 text-base text-neutral-400 max-w-2xl">
                터미널에서 바로 쓰고 싶다면 CLI로, 브라우저에서 파일을 올려 확인하고 싶다면 Web으로 시작하세요.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {/* CLI Card */}
              <button
                onClick={handleCliClick}
                className="group flex flex-col justify-between rounded-[32px] border border-neutral-800 bg-[#222] p-8 text-left transition-all hover:border-neutral-600 hover:bg-[#2A2A2A]"
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
                  설치 가이드 보기 <ArrowRightIcon />
                </div>
              </button>

              {/* Web Card */}
              <button
                onClick={handleWebClick}
                className="group flex flex-col justify-between rounded-[32px] bg-[#D4FC64] p-8 text-left transition-all hover:brightness-105"
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
                  웹에서 바로 시작 <ArrowRightIcon />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  );
}
