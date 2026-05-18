import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

type SeverityTone = 'critical' | 'high' | 'medium' | 'low';

type SeverityBlockProps = {
  tone: SeverityTone;
  label: string;
  value: number;
};

const toneStyles: Record<
  SeverityTone,
  { bg: string; bar: string; label: string; valueActive: string }
> = {
  critical: {
    bg: 'bg-[#FCEAEA]',
    bar: 'bg-[#E74C3C]',
    label: 'text-[#A33329]',
    valueActive: 'text-[#A33329]',
  },
  high: {
    bg: 'bg-[#FAF5E0]',
    bar: 'bg-[#E6B33C]',
    label: 'text-[#7A5F12]',
    valueActive: 'text-[#7A5F12]',
  },
  medium: {
    bg: 'bg-[#FAE9D5]',
    bar: 'bg-[#E89B43]',
    label: 'text-[#7A4D14]',
    valueActive: 'text-[#0F0F0F]',
  },
  low: {
    bg: 'bg-[#E5EEFC]',
    bar: 'bg-[#6B89DD]',
    label: 'text-[#3D4F94]',
    valueActive: 'text-[#0F0F0F]',
  },
};

function useCountUp(target: number, durationMs = 600) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let frameId = 0;
    let startedAt = 0;

    const tick = (timestamp: number) => {
      if (startedAt === 0) startedAt = timestamp;
      const progress = Math.min((timestamp - startedAt) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));
      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [target, durationMs]);

  return current;
}

function SeverityBlock({ tone, label, value }: SeverityBlockProps) {
  const styles = toneStyles[tone];
  const isActive = value > 0;
  const animatedValue = useCountUp(value);

  return (
    <motion.div
      className={`relative flex flex-col gap-3 overflow-hidden ${styles.bg} p-5 pl-6 landing-inner-radius`}
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {/* 좌측 컬러 막대 */}
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${styles.bar}`} />

      <p className={`text-[10px] font-mono font-bold uppercase tracking-[0.2em] ${styles.label}`}>{label}</p>
      <p className={`text-4xl font-black tabular-nums ${isActive ? styles.valueActive : 'text-neutral-300'}`}>
        {animatedValue}
      </p>
    </motion.div>
  );
}

export default SeverityBlock;
