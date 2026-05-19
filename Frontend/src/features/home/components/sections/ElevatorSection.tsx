import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { useRef } from 'react';

/**
 * 엘리베이터 ele.png + boxbox.png가 스크롤에 따라 박스가 차오르는 신.
 * LandingPage / LandingPage2 양쪽에서 공유.
 */
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

export default ElevatorSection;
