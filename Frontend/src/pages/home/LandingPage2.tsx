import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { useRef } from 'react';

import AppleHeroSection from '../../features/home/components/AppleHeroSection';
import ElevatorSection from '../../features/home/components/sections/ElevatorSection';
import FloorsSection from '../../features/home/components/sections/FloorsSection';
import { useForceLightTheme } from '../../features/home/hooks/useForceLightTheme';

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
  useForceLightTheme();

  return (
    <div className="relative bg-black text-white">
      {/* Section 1: 사과 — 공통 AppleHeroSection 컴포넌트 사용 */}
      <AppleHeroSection bottomFadeColor="#BB3A34" />

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

      {/* Local CSS — LP2 전용 (Section 6 VISION 타이포) */}
      <style>{`
        .vision-label {
          font-family: 'Montserrat', "Segoe UI", "Helvetica Neue", sans-serif;
          font-weight: 200;
        }
      `}</style>
    </div>
  );
}

export default LandingPage2;
