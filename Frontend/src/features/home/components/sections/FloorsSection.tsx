import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

type FloorData = {
  floor: string;
  title: string;
  description: readonly [string, string];
};

const FLOORS: readonly FloorData[] = [
  {
    floor: '1F',
    title: '입구 / 업로드',
    description: [
      '프로젝트를 맡겨주세요.',
      'SSAFER가 배포 전 확인해야 할 설정 파일부터 살펴봅니다.',
    ],
  },
  {
    floor: '2F',
    title: '검사실 / 진단',
    description: [
      '보이지 않던 빈틈을 찾아냅니다.',
      '위험한 설정과 노출 가능성을 빠르게 감지합니다.',
    ],
  },
  {
    floor: '3F',
    title: '상담실 / 해설',
    description: [
      '어려운 보안을 쉽게 설명합니다.',
      '무엇이 문제인지, 왜 고쳐야 하는지, 어떻게 바꾸면 되는지 알려줍니다.',
    ],
  },
  {
    floor: '4F',
    title: '보관함 / 기록',
    description: [
      '보안 상태를 계속 기억합니다.',
      '이전 진단 결과를 남겨 더 안전해지는 과정을 확인할 수 있습니다.',
    ],
  },
];

/**
 * 4개 층 소개 — 에디토리얼 타이포 + 좌우 지그재그 + 가운데 엘리베이터 샤프트 라인.
 * 자체 .floors-numeral CSS 포함.
 */
function FloorsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const shaftScaleY = useTransform(scrollYProgress, [0.05, 0.75], [0, 1]);

  return (
    <section
      className="relative min-h-[160vh] w-full overflow-hidden bg-[#EEEEEE] py-24 md:py-28"
      ref={ref}
    >
      {/* 가운데 엘리베이터 샤프트 라인이 스크롤에 따라 위에서 아래로 자라남 */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-24 hidden h-[calc(100%-12rem)] w-px origin-top -translate-x-1/2 bg-neutral-400/70 md:block"
        style={{ scaleY: shaftScaleY }}
      />

      <div className="relative mx-auto flex max-w-5xl flex-col gap-20 px-6 md:gap-28">
        {FLOORS.map((floor, i) => {
          const isLeft = i % 2 === 0;
          return (
            <motion.div
              className={`relative flex items-start gap-6 md:gap-14 ${isLeft ? '' : 'md:flex-row-reverse md:text-right'}`}
              initial={{ opacity: 0, x: isLeft ? -90 : 90 }}
              key={floor.floor}
              transition={{ duration: 0.7, type: 'spring', stiffness: 95, damping: 20 }}
              viewport={{ amount: 0.35, once: false }}
              whileInView={{ opacity: 1, x: 0 }}
            >
              {/* 층 번호 (에디토리얼 타이포) */}
              <div className={`flex shrink-0 flex-col gap-3 ${isLeft ? 'items-start' : 'md:items-end'}`}>
                <span className="floors-numeral text-[4.5rem] leading-none tracking-[-0.04em] text-neutral-400/85 md:text-[6rem] lg:text-[7rem]">
                  {`0${i + 1}`}
                </span>
                <div className={`flex items-center gap-2.5 ${isLeft ? '' : 'md:flex-row-reverse'}`}>
                  <span className="h-px w-8 bg-neutral-500/60" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-neutral-500">
                    {floor.floor}
                  </span>
                </div>
              </div>

              <div className="flex-1 pt-2">
                <h3 className="text-xl font-bold leading-tight text-neutral-900 md:text-2xl lg:text-3xl">
                  {floor.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-700 md:text-base lg:text-lg">
                  {floor.description[0]}
                </p>
                <p className="text-sm leading-relaxed text-neutral-700 md:text-base lg:text-lg">
                  {floor.description[1]}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <style>{`
        .floors-numeral {
          font-family: 'Montserrat', "Segoe UI", "Helvetica Neue", sans-serif;
          font-weight: 200;
        }
      `}</style>
    </section>
  );
}

export default FloorsSection;
