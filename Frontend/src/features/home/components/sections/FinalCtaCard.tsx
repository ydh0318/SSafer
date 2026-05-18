import { motion } from 'framer-motion';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { ROUTES } from '../../../../constants/routes';
import { useToast } from '../../../feedback/useToast';
import RevealOnScroll from '../primitives/RevealOnScroll';

type FinalCtaCardProps = {
  onOpenEntry: () => void;
};

const COMMAND = 'pip install ssafer && ssafer run --upload';

function FinalCtaCard({ onOpenEntry }: FinalCtaCardProps) {
  const toast = useToast();
  const [justCopied, setJustCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(COMMAND);
      setJustCopied(true);
      toast.success('명령어가 복사되었습니다.');
      window.setTimeout(() => setJustCopied(false), 1600);
    } catch {
      toast.error('복사에 실패했습니다. 직접 선택해 주세요.');
    }
  };

  return (
    <section className="mx-auto max-w-[1160px] px-5 pb-24 pt-8 md:px-7 landing-anim">
      <RevealOnScroll>
        <div
          className="relative overflow-hidden bg-[#0F0F0F] px-6 py-16 text-center text-white md:px-12 md:py-20"
          style={{ borderRadius: 'var(--radius-landing-cta)' }}
        >
          {/* 부드러운 라임 글로우 */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[640px] -translate-x-1/2 rounded-full bg-[#D4FC64]/15 blur-3xl"
          />

          <motion.h2
            className="relative text-4xl font-black tracking-tight md:text-6xl"
            initial={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            30초면 됩니다
          </motion.h2>
          <p className="relative mx-auto mt-6 max-w-md text-sm leading-relaxed text-white/70 md:text-base">
            설정 파일만 올리세요. 로그인 없이 바로 체험할 수 있습니다.
            <br />
            민감 정보는 자동 마스킹됩니다.
          </p>

          <div className="relative mt-10 flex flex-wrap items-center justify-center gap-5">
            <motion.button
              className="inline-flex h-12 items-center gap-2 bg-[#D4FC64] px-7 text-sm font-bold text-[#0F0F0F] transition hover:shadow-[0_18px_40px_rgba(212,252,100,0.35)]"
              onClick={onOpenEntry}
              style={{ borderRadius: 'var(--radius-landing-inner)' }}
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              웹에서 체험하기
              <ArrowRight className="h-4 w-4" />
            </motion.button>
            <Link
              className="inline-flex h-12 items-center gap-2 px-3 text-sm text-white/80 transition hover:text-white"
              to={ROUTES.guide}
            >
              CLI 설치 가이드
            </Link>
          </div>

          {/* 터미널 박스 */}
          <div className="relative mt-10 flex justify-center">
            <div
              className="group flex w-full max-w-xl items-center gap-3 border border-white/10 bg-black/55 px-5 py-3.5 font-mono text-sm text-white/85 transition hover:border-white/20"
              style={{ borderRadius: 'var(--radius-landing-inner)' }}
            >
              <span className="text-[#D4FC64]">$</span>
              <span className="flex-1 truncate text-left">{COMMAND}</span>
              <button
                aria-label="명령어 복사"
                className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-white"
                onClick={handleCopy}
                type="button"
              >
                {justCopied ? <Check className="h-4 w-4 text-[#D4FC64]" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </RevealOnScroll>
    </section>
  );
}

export default FinalCtaCard;
