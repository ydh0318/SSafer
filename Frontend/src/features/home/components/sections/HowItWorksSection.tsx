import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import RevealOnScroll from '../primitives/RevealOnScroll';
import { revealItemVariants } from '../primitives/revealVariants';

type HowItem = {
  step: string;
  title: ReactNode;
  description: ReactNode;
};

const items: HowItem[] = [
  {
    step: '01',
    title: '설정 파일 올리기',
    description: 'docker-compose, .env, sshd_config 같은 거. 웹에서 드래그앤드롭 하거나, CLI로 ssafer run 치면 됨.',
  },
  {
    step: '02',
    title: '위험한 거 잡아냄',
    description: 'privileged: true, 하드코딩된 비번, 열려 있는 DB 포트. 룰 기반으로 확실한 것만 잡음. 애매한 건 안 잡음.',
  },
  {
    step: '03',
    title: '왜 위험한지 + 고치는 법',
    description: 'AI가 각 finding을 해석해서 이유랑 수정 코드를 줌. before/after diff로 뭘 바꿔야 하는지 바로 보임.',
  },
  {
    step: '04',
    title: '결과 남기고 공유',
    description: 'scanId로 저장되니까 팀원한테 URL 던져주면 끝. 체크리스트로 하나씩 해결 표시하면서 진행.',
  },
];

function HowItWorksSection() {
  return (
    <section className="mx-auto max-w-[1160px] px-5 pb-16 pt-6 md:px-7 landing-anim">
      <RevealOnScroll>
        <p className="text-[10px] font-mono uppercase tracking-[0.42em] text-neutral-400">// HOW IT WORKS</p>
        <h2 className="mt-4 text-3xl font-black leading-[1.1] tracking-tight text-[#0F0F0F] md:text-5xl">
          복잡한 보안 설정,
          <br />
          흐름은 단순하게
        </h2>
      </RevealOnScroll>

      <RevealOnScroll className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4" stagger={0.08}>
        {items.map((item) => (
          <motion.article
            className="group relative cursor-default border border-black/8 bg-white p-7 landing-card-radius transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[#D4FC64] hover:bg-[#FBFFE8] hover:shadow-[0_24px_60px_rgba(190,242,100,0.35)]"
            key={item.step}
            variants={revealItemVariants}
          >
            <p className="text-5xl font-mono font-black tracking-tight text-neutral-300 transition-colors duration-300 group-hover:text-[#9CBF35]">
              {item.step}
            </p>
            <h3 className="mt-8 text-lg font-black tracking-tight text-[#0F0F0F] md:text-xl">{item.title}</h3>
            <p className="mt-5 text-sm leading-7 text-neutral-500 transition-colors duration-300 group-hover:text-neutral-600">
              {item.description}
            </p>

            {/* hover 시에만 보이는 라임 ring (은은한 pulse) */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 landing-card-radius opacity-0 ring-1 ring-[#D4FC64] transition-opacity duration-300 group-hover:opacity-100 group-hover:animate-[howCardPulse_2.4s_ease-in-out_infinite]"
            />
          </motion.article>
        ))}
      </RevealOnScroll>
    </section>
  );
}

export default HowItWorksSection;
