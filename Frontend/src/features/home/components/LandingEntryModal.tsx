import { ArrowRight, Check, Copy, LoaderCircle, ScanSearch, TerminalSquare, UserRound } from 'lucide-react';
import { useState } from 'react';

import ModalFrame from '../../../components/common/ModalFrame';
import { useAuthStore } from '../../../store/authStore';

type LandingEntryModalProps = {
  errorMessage: string | null;
  isGuestPending: boolean;
  onClose: () => void;
  onIssueGuestToken: () => void;
  onStartCli: () => void;
  onStartUpload: () => void;
};

function LandingEntryModal({
  errorMessage,
  isGuestPending,
  onClose,
  onIssueGuestToken,
  onStartCli,
  onStartUpload,
}: LandingEntryModalProps) {
  const [copied, setCopied] = useState(false);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isGuestSession = isAuthenticated && !refreshToken && Boolean(accessToken);

  const handleCopyCommand = async () => {
    if (!accessToken) {
      return;
    }

    await navigator.clipboard.writeText(`ssafer login --guest-token ${accessToken}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalFrame onClose={onClose}>
      <div className="theme-entry-modal overflow-hidden rounded-[2rem] border border-black/10 bg-[#fbfaf4]">
        <div className="border-b border-black/10 bg-[linear-gradient(135deg,#f7f0cf_0%,#fffdf6_50%,#e4f0d4_100%)] px-6 py-6 sm:px-8">
          <p className="text-[11px] font-mono tracking-[0.28em] text-neutral-500">START SSAFER</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-[#161616] sm:text-4xl">
            {'\uC5B4\uB5A4 \uBC29\uC2DD\uC73C\uB85C \uBA3C\uC800 \uC2DC\uC791\uD574\uBCFC\uAE4C\uC694?'}
          </h2>
        </div>

        <div className="grid gap-4 px-6 py-5 sm:px-8 md:grid-cols-2">
          <button
            className="group rounded-[1.5rem] border border-black/10 bg-white p-4 text-left shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_24px_64px_rgba(15,23,42,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isGuestPending}
            onClick={onStartUpload}
            type="button"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#dff0cc] text-[#1f4220]">
              {isGuestPending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ScanSearch className="h-5 w-5" />}
            </span>
            <div className="mt-3 text-lg font-black text-[#161616]">
              {'\uD30C\uC77C \uC5C5\uB85C\uB4DC \uC774\uC6A9\uD574\uBCF4\uAE30'}
            </div>
            <p className="mt-1.5 text-sm leading-5 text-neutral-600">
              {'\uC124\uC815 \uD30C\uC77C\uC744 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uBC14\uB85C \uC62C\uB9AC\uACE0, \uD504\uB85C\uC81D\uD2B8 \uD654\uBA74\uC5D0\uC11C \uBE60\uB974\uAC8C \uC2A4\uCE94 \uACB0\uACFC\uB97C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#161616]">
              {'\uC5C5\uB85C\uB4DC \uD654\uBA74\uC73C\uB85C \uC774\uB3D9'}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </button>

          <button
            className="group rounded-[1.5rem] border border-black/10 bg-[#161616] p-4 text-left text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-black"
            onClick={onStartCli}
            type="button"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white">
              <TerminalSquare className="h-5 w-5" />
            </span>
            <div className="mt-3 text-lg font-black">
              {'CLI\uB85C \uC2DC\uC791\uD574\uBCF4\uAE30'}
            </div>
            <p className="mt-1.5 text-sm leading-5 text-white/72">
              {'\uB85C\uCEEC \uD658\uACBD\uC774\uB098 \uC11C\uBC84\uC5D0\uC11C \uC804\uCCB4 \uD504\uB85C\uC81D\uD2B8\uB97C \uC810\uAC80\uD560 \uC218 \uC788\uB3C4\uB85D CLI \uC124\uCE58\uC640 \uC2E4\uD589 \uAC00\uC774\uB4DC\uB85C \uBC14\uB85C \uC774\uB3D9\uD569\uB2C8\uB2E4.'}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-white">
              {'CLI \uAC00\uC774\uB4DC \uBCF4\uAE30'}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>

        <div className="border-t border-black/10 px-6 py-5 sm:px-8">
          <div className="rounded-[1.5rem] border border-black/10 bg-white/70 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-mono tracking-[0.24em] text-neutral-500">GUEST CLI TOKEN</p>
                <h3 className="mt-1.5 text-base font-black text-[#161616]">
                  {'\uAC8C\uC2A4\uD2B8 \uC138\uC158\uC73C\uB85C CLI \uC774\uC6A9\uD558\uAE30'}
                </h3>
                <p className="mt-1.5 text-sm leading-5 text-neutral-600">
                  {'\uAC8C\uC2A4\uD2B8 \uD1A0\uD070\uC744 \uBC1C\uAE09\uD55C \uB4A4 \uC544\uB798 \uBA85\uB839\uC73C\uB85C \uB85C\uADF8\uC778\uD558\uBA74, CLI\uC5D0\uC11C\uB3C4 \uBC14\uB85C ssafer\uB97C \uCCB4\uD5D8\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}
                </p>
              </div>
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef2e2] text-[#2f8a4a]">
                <UserRound className="h-5 w-5" />
              </span>
            </div>

            {isGuestSession ? (
              <>
                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-neutral-200 bg-[#f7f7f2] px-4 py-3">
                  <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm text-[#2f8a4a]">
                    {'ssafer login --guest-token '}
                    <span className="text-neutral-500">{accessToken}</span>
                  </code>
                  <button
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/10 text-neutral-600 transition hover:border-black/20 hover:text-black"
                    onClick={() => void handleCopyCommand()}
                    type="button"
                  >
                    {copied ? <Check className="h-4 w-4 text-[#2f8a4a]" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-2 text-xs leading-5 text-neutral-500">
                  {'\uBC1C\uAE09\uB41C \uD1A0\uD070\uC740 \uD604\uC7AC \uBE0C\uB77C\uC6B0\uC800\uC758 \uAC8C\uC2A4\uD2B8 \uC138\uC158\uACFC \uC5F0\uACB0\uB429\uB2C8\uB2E4. \uD130\uBBF8\uB110\uC5D0\uC11C \uC704 \uBA85\uB839\uC744 \uC2E4\uD589\uD55C \uB4A4 CLI\uB97C \uC2DC\uC791\uD558\uC138\uC694.'}
                </p>
              </>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#161616] px-5 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isGuestPending}
                  onClick={onIssueGuestToken}
                  type="button"
                >
                  {isGuestPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
                  {'\uAC8C\uC2A4\uD2B8 \uD1A0\uD070 \uBC1C\uAE09\uD558\uAE30'}
                </button>
                <p className="text-xs leading-5 text-neutral-500">
                  {'\uBC84\uD2BC\uC744 \uB204\uB974\uBA74 \uAC8C\uC2A4\uD2B8 \uC138\uC158\uC774 \uC0DD\uC131\uB418\uACE0, CLI \uB85C\uADF8\uC778 \uBA85\uB839\uC744 \uBC14\uB85C \uBCF5\uC0AC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}
                </p>
              </div>
            )}
          </div>
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
