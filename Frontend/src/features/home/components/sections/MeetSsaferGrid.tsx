import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import PixelGoose from '../../../../components/common/PixelGoose';
import { ROUTES } from '../../../../constants/routes';
import RevealOnScroll from '../primitives/RevealOnScroll';
import { revealItemVariants } from '../primitives/revealVariants';

type MeetSsaferGridProps = {
  scanCount: string;
  findingCount: string;
  criticalCount: string;
  activeMonth: string;
};

function MeetSsaferGrid({ scanCount, findingCount, criticalCount, activeMonth }: MeetSsaferGridProps) {
  return (
    <RevealOnScroll
      as="section"
      className="mx-auto max-w-[1160px] px-5 pb-12 pt-3 md:px-7 landing-anim"
      stagger={0.08}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* 좌측 큰 검정 카드 - 거위 */}
        <motion.article
          className="group relative overflow-hidden bg-[#111111] p-8 text-white md:col-span-7 md:row-span-2 landing-card-radius transition duration-500 hover:shadow-[0_30px_80px_rgba(0,0,0,0.25)]"
          variants={revealItemVariants}
          whileHover={{ y: -4 }}
        >
          <p className="text-[10px] font-mono uppercase tracking-[0.42em] text-white/50">MEET SSAFE</p>
          <div className="mt-7 text-3xl font-black leading-tight md:text-[2.4rem]">
            저예요.
            <br />
            보안 거위 <span className="text-[#D4FC64]">SSAFER</span>.
          </div>
          <p className="mt-5 text-sm leading-relaxed text-white/70 md:text-base">
            코드를 같이 봐드려요. 친구는 아니고, 그냥 거위.
          </p>

          <div className="mt-10 flex items-end justify-between gap-6">
            <div
              className="border border-white/12 bg-[linear-gradient(135deg,#fffef7_0%,#fff6cf_100%)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.18)] transition duration-500 group-hover:rotate-[-3deg]"
              style={{ borderRadius: 'var(--radius-landing-inner)' }}
            >
              <PixelGoose mood="happy" size={132} />
            </div>
            <Link
              className="inline-flex items-center gap-2 text-xs text-white/60 transition hover:text-white"
              to={ROUTES.typingGame}
            >
              연습하러
              <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </motion.article>

        {/* 우상 - 누적 스캔 회색 카드 */}
        <motion.article
          className="bg-[#F2F2EF] p-7 md:col-span-5 landing-card-radius transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.06)]"
          variants={revealItemVariants}
        >
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-neutral-500">누적 스캔</p>
          <div className="mt-4 text-5xl font-black tabular-nums text-[#0F0F0F] md:text-6xl">{scanCount}</div>
          <p className="mt-5 text-xs text-neutral-500">
            누적 탐지 <span className="font-semibold text-[#0F0F0F]">{findingCount}</span>
            <span className="mx-1.5 text-neutral-400">·</span>
            Critical <span className="font-semibold text-[#0F0F0F]">{criticalCount}</span>
            <span className="mx-1.5 text-neutral-400">·</span>
            {activeMonth} 기준
          </p>
        </motion.article>

        {/* 우하 - 라임 웹 체험 카드 */}
        <motion.article
          className="bg-[#D4FC64] p-7 md:col-span-5 landing-card-radius transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(190,242,100,0.45)]"
          variants={revealItemVariants}
        >
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-[#0F0F0F]/60">웹 체험은 로그인 없이</p>
          <div className="mt-3 text-2xl font-black leading-tight text-[#0F0F0F] md:text-[1.75rem]">
            파일 3개, 1MB 이하
            <br />
            결과는 즉시 휘발
          </div>
          <p className="mt-5 text-xs text-[#0F0F0F]/70">민감정보 저장 ✕ · 스트리밍 처리 후 삭제</p>
        </motion.article>
      </div>
    </RevealOnScroll>
  );
}

export default MeetSsaferGrid;
