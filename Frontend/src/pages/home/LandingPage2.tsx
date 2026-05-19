import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { useRef } from 'react';

import AppleHeroSection from '../../features/home/components/AppleHeroSection';

/* ============== Section 2: 빨간/회색 + 문 ============== */
function DoorSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const headlineRawY = useTransform(scrollYProgress, [0.05, 0.35], [-140, 0]);
  const headlineY = useSpring(headlineRawY, { stiffness: 110, damping: 22 });
  const headlineOpacity = useTransform(scrollYProgress, [0.05, 0.25], [0, 1]);

  const doorRawY = useTransform(scrollYProgress, [0.12, 0.6], [-320, 0]);
  const doorY = useSpring(doorRawY, { stiffness: 90, damping: 18 });
  const doorScale = useTransform(scrollYProgress, [0.12, 0.6], [0.5, 1]);
  const doorOpacity = useTransform(scrollYProgress, [0.12, 0.32], [0, 1]);
  const doorRotate = useTransform(scrollYProgress, [0.12, 0.6], [-4, 0]);

  return (
    <section className="relative h-screen w-full overflow-hidden" ref={ref}>
      <div className="absolute inset-x-0 top-0 h-[62%] bg-[#BB3A34]" />
      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[#EEEEEE]" />

      <div className="relative z-10 flex h-full flex-col items-center px-6 pt-[22vh]">
        <motion.h2
          className="text-center text-2xl font-bold leading-snug text-white md:text-3xl lg:text-[2.2rem]"
          style={{ y: headlineY, opacity: headlineOpacity }}
        >
          여러분의 서비스,안전하게 배포되고 있나요?
        </motion.h2>
      </div>

      <motion.img
        alt=""
        className="pointer-events-none absolute left-1/2 top-[33%] w-[260px] -translate-x-1/2 select-none md:w-[340px] lg:w-[400px]"
        draggable={false}
        src="/landing/whitedoor.png"
        style={{ y: doorY, scale: doorScale, opacity: doorOpacity, rotate: doorRotate }}
      />
    </section>
  );
}

/* ============== Section 3: 엘리베이터 + 박스 ============== */
function ElevatorSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const elevatorRawY = useTransform(scrollYProgress, [0, 0.3], [80, 0]);
  const elevatorY = useSpring(elevatorRawY, { stiffness: 110, damping: 22 });
  const elevatorOpacity = useTransform(scrollYProgress, [0, 0.22], [0, 1]);

  const rawBoxY = useTransform(scrollYProgress, [0.22, 0.7], [240, 0]);
  const boxY = useSpring(rawBoxY, { stiffness: 95, damping: 18 });
  const boxOpacity = useTransform(scrollYProgress, [0.22, 0.45], [0, 1]);
  const boxScale = useTransform(scrollYProgress, [0.22, 0.7], [0.55, 1]);
  const boxRotate = useTransform(scrollYProgress, [0.22, 0.7], [-4, 0]);

  return (
    <section className="relative h-screen w-full overflow-hidden bg-[#EEEEEE]" ref={ref}>
      <motion.img
        alt=""
        className="absolute inset-0 h-full w-full select-none object-contain object-center"
        draggable={false}
        src="/landing/ele.png"
        style={{ y: elevatorY, opacity: elevatorOpacity }}
      />
      <motion.img
        alt=""
        className="pointer-events-none absolute bottom-[12%] right-[20%] z-10 w-[26%] max-w-[460px] select-none drop-shadow-[0_18px_24px_rgba(0,0,0,0.28)]"
        draggable={false}
        src="/landing/boxbox.png"
        style={{ y: boxY, opacity: boxOpacity, scale: boxScale, rotate: boxRotate }}
      />
    </section>
  );
}

/* ============== Section 4: 4개 층 소개 ============== */
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

function FloorsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // 가운데 엘리베이터 샤프트 라인이 스크롤에 따라 위에서 아래로 자라남
  const shaftScaleY = useTransform(scrollYProgress, [0.05, 0.75], [0, 1]);

  return (
    <section
      className="relative min-h-[160vh] w-full overflow-hidden bg-[#EEEEEE] py-24 md:py-28"
      ref={ref}
    >
      {/* 엘리베이터 샤프트 라인 */}
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
                <span className="floor-numeral text-[4.5rem] leading-none tracking-[-0.04em] text-neutral-400/85 md:text-[6rem] lg:text-[7rem]">
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
    </section>
  );
}

/* ============== Section 5: 박스 포장 + 문장 ============== */
function BoxWrapSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const bgScale = useTransform(scrollYProgress, [0, 0.5], [1.04, 1]);

  const text1RawY = useTransform(scrollYProgress, [0.30, 0.55], [60, 0]);
  const text1Y = useSpring(text1RawY, { stiffness: 110, damping: 22 });
  const text1Opacity = useTransform(scrollYProgress, [0.30, 0.50], [0, 1]);

  const text2RawX = useTransform(scrollYProgress, [0.50, 0.72], [90, 0]);
  const text2X = useSpring(text2RawX, { stiffness: 110, damping: 22 });
  const text2Opacity = useTransform(scrollYProgress, [0.50, 0.70], [0, 1]);

  return (
    // section aspectRatio = box.png natural aspect (1122/1402) → 이미지가 잘리지도 늘어나지도 않고 섹션을 완전히 채움
    <section
      className="relative w-full overflow-hidden bg-white"
      ref={ref}
      style={{ aspectRatio: '1122 / 1402' }}
    >
      <motion.img
        alt=""
        className="absolute inset-0 h-full w-full select-none"
        draggable={false}
        src="/landing/box.png"
        style={{ scale: bgScale }}
      />

      <motion.div
        className="absolute left-[6%] top-[55%] z-10 text-black"
        style={{ y: text1Y, opacity: text1Opacity }}
      >
        <p className="whitespace-nowrap text-2xl font-bold leading-tight md:text-3xl lg:text-4xl">개발 입문자의 든든한 동반자</p>
        <p className="whitespace-nowrap text-2xl font-bold leading-tight md:text-3xl lg:text-4xl">코파일럿 입니다</p>
      </motion.div>

      <motion.div
        className="absolute right-[6%] top-[72%] z-10 text-right text-black/85"
        style={{ x: text2X, opacity: text2Opacity }}
      >
        <p className="whitespace-nowrap text-2xl font-bold leading-tight md:text-3xl lg:text-4xl">취약점부터 수정안까지,</p>
        <p className="whitespace-nowrap text-2xl font-bold leading-tight md:text-3xl lg:text-4xl">한 번에 챙겨드려요</p>
      </motion.div>
    </section>
  );
}

/* ============== Section 6: VISION ============== */
function VisionSection() {
  return (
    <section className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-[#EEEEEE]">
      <div className="text-center">
        <motion.div
          className="vision-label text-sm uppercase tracking-[0.55em] text-[#2563EB] md:text-base"
          initial={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.5 }}
          viewport={{ amount: 0.5, once: false }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          VISION
        </motion.div>
        <motion.h2
          className="mt-8 text-2xl font-bold leading-tight text-neutral-900 md:text-3xl lg:text-4xl"
          initial={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          viewport={{ amount: 0.4, once: false }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          왜 SSAFER를
        </motion.h2>
        <motion.h2
          className="text-2xl font-bold leading-tight text-neutral-900 md:text-3xl lg:text-4xl"
          initial={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ amount: 0.4, once: false }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          선택할까요?
        </motion.h2>
      </div>
    </section>
  );
}

/* ============== LandingPage2 (composed sections) ============== */
function LandingPage2() {
  return (
    <div className="relative bg-black text-white">
      {/* Section 1: 사과 — 공통 AppleHeroSection 컴포넌트 사용 */}
      <AppleHeroSection />

      {/* Section 2 */}
      <DoorSection />

      {/* Section 3 */}
      <ElevatorSection />

      {/* Section 4: 4개 층 소개 */}
      <FloorsSection />

      {/* Section 5: 박스 포장 */}
      <BoxWrapSection />

      {/* Section 6: VISION */}
      <VisionSection />

      {/* Local CSS — LP2 전용 (Section 4·6 타이포) */}
      <style>{`
        .floor-numeral {
          font-family: 'Montserrat', "Segoe UI", "Helvetica Neue", sans-serif;
          font-weight: 200;
        }
        .vision-label {
          font-family: 'Montserrat', "Segoe UI", "Helvetica Neue", sans-serif;
          font-weight: 200;
        }
      `}</style>
    </div>
  );
}

export default LandingPage2;
