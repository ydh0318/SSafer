import { ArrowRight, LoaderCircle, LogIn, UserRound } from 'lucide-react';

import ModalFrame from '../../../components/common/ModalFrame';

type LandingEntryModalProps = {
  errorMessage: string | null;
  isGuestPending: boolean;
  onClose: () => void;
  onContinueAsGuest: () => void;
  onLogin: () => void;
};

function LandingEntryModal({
  errorMessage,
  isGuestPending,
  onClose,
  onContinueAsGuest,
  onLogin,
}: LandingEntryModalProps) {
  return (
    <ModalFrame onClose={onClose}>
      <div className="theme-entry-modal overflow-hidden rounded-[2rem] border border-black/10 bg-[#fbfaf4]">
        <div className="border-b border-black/10 bg-[linear-gradient(135deg,#f7f0cf_0%,#fffdf6_50%,#e4f0d4_100%)] px-6 py-8 sm:px-8">
          <p className="text-[11px] font-mono tracking-[0.28em] text-neutral-500">START SSAFER</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-[#161616] sm:text-4xl">어떤 방식으로 시작할까요?</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-700 sm:text-base">
            바로 체험하고 싶다면 게스트 모드로, 작업 이력과 계정 기능까지 쓰려면 로그인으로 이어가면 됩니다.
          </p>
        </div>

        <div className="grid gap-4 px-6 py-6 sm:px-8 md:grid-cols-2">
          <button
            className="group rounded-[1.5rem] border border-black/10 bg-white p-5 text-left shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_24px_64px_rgba(15,23,42,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isGuestPending}
            onClick={onContinueAsGuest}
            type="button"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#dff0cc] text-[#1f4220]">
              {isGuestPending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <UserRound className="h-5 w-5" />}
            </span>
            <div className="mt-4 text-xl font-black text-[#161616]">게스트 모드로 이용하기</div>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              회원가입 없이 바로 프로젝트 화면으로 이동해 핵심 플로우를 먼저 둘러볼 수 있습니다.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#161616]">
              지금 체험하기
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </button>

          <button
            className="group rounded-[1.5rem] border border-black/10 bg-[#161616] p-5 text-left text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-black"
            onClick={onLogin}
            type="button"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white">
              <LogIn className="h-5 w-5" />
            </span>
            <div className="mt-4 text-xl font-black">로그인 하기</div>
            <p className="mt-2 text-sm leading-6 text-white/72">
              계정으로 로그인하면 소셜 연동, 히스토리, 설정 같은 개인화 기능까지 바로 이어서 사용할 수 있습니다.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-white">
              로그인 화면으로 이동
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>

        {errorMessage ? (
          <div className="px-6 pb-6 sm:px-8">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {errorMessage}
            </div>
          </div>
        ) : null}
      </div>
    </ModalFrame>
  );
}

export default LandingEntryModal;
