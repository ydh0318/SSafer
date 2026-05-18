import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import RevealOnScroll from '../primitives/RevealOnScroll';
import { revealItemVariants } from '../primitives/revealVariants';
import TagBadge from '../primitives/TagBadge';

type WhyItem = {
  step: string;
  title: ReactNode;
  description: ReactNode;
  badge: { label: string; tone: 'dark' | 'accent' | 'outline' };
};

const items: WhyItem[] = [
  {
    step: '01',
    title: '고정된 룰셋',
    description:
      '탐지 기준이 버전 관리되고 팀 전체에 동일하게 적용됩니다. LLM 세션마다 결과가 달라지지 않습니다. 누가, 언제 실행해도 같은 10개 룰이 같은 기준으로 동작합니다.',
    badge: { label: 'DETERMINISTIC', tone: 'dark' },
  },
  {
    step: '02',
    title: (
      <>
        결정론적 탐지 +
        <br />
        확률적 설명의 분리
      </>
    ),
    description:
      '취약점(findings)은 100% 룰 기반으로 생성됩니다. AI는 이미 탐지된 항목을 "해석"만 합니다. 할루시네이션으로 가짜 취약점이 만들어질 수 없는 구조입니다.',
    badge: { label: 'NO HALLUCINATED FINDINGS', tone: 'accent' },
  },
  {
    step: '03',
    title: '마스킹 레이어',
    description: (
      <>
        .env 원본 값이 외부 LLM으로 절대 전송되지 않습니다. password, api_key, token, private key 등을 자동 마스킹한 후에만 분석합니다. Cursor를 못 쓰는 기업 환경을 위해 설계되었습니다.
      </>
    ),
    badge: { label: 'COMPLIANCE READY', tone: 'outline' },
  },
  {
    step: '04',
    title: '스캔 이력의 영속성',
    description:
      'scanId로 프로젝트의 보안 상태 변화를 시계열로 추적합니다. "지난주에 고친 게 이번 주에 다시 나왔는지" 한눈에 확인. 체크리스트로 해결 진행률을 관리합니다.',
    badge: { label: 'SCAN HISTORY', tone: 'outline' },
  },
];

function WhySsaferSection() {
  return (
    <section className="mx-auto max-w-[1160px] px-5 pb-20 pt-12 md:px-7 landing-anim">
      <RevealOnScroll>
        <p className="text-[10px] font-mono uppercase tracking-[0.42em] text-neutral-400">WHY SSAFER</p>
        <h2 className="mt-4 text-3xl font-black leading-[1.1] tracking-tight text-[#0F0F0F] md:text-5xl">
          Cursor에 Trivy 결과
          <br />
          붙여넣으면 되잖아요?
        </h2>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-neutral-500 md:text-base">
          비슷한 설명은 나옵니다. 하지만 팀에서, 반복적으로, 안전하게 쓰려면 이 네 가지가 필요합니다.
        </p>
      </RevealOnScroll>

      <RevealOnScroll className="mt-10 grid gap-4 md:grid-cols-2" stagger={0.1}>
        {items.map((item) => (
          <motion.article
            className="group relative flex flex-col border border-black/8 bg-white p-8 landing-card-radius transition duration-300 hover:-translate-y-1 hover:border-black/15 hover:shadow-[0_22px_50px_rgba(15,23,42,0.07)]"
            key={item.step}
            variants={revealItemVariants}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-mono tracking-[0.32em] text-neutral-400">{item.step}</p>
              <span className="h-px flex-1 ml-4 bg-neutral-200 transition group-hover:bg-neutral-300" />
            </div>
            <h3 className="mt-7 text-xl font-black leading-snug text-[#0F0F0F] md:text-2xl">{item.title}</h3>
            <p className="mt-5 text-sm leading-relaxed text-neutral-500 md:text-[15px]">{item.description}</p>
            <div className="mt-7">
              <TagBadge tone={item.badge.tone}>{item.badge.label}</TagBadge>
            </div>
          </motion.article>
        ))}
      </RevealOnScroll>
    </section>
  );
}

export default WhySsaferSection;
