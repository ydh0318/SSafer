import { motion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

type RevealOnScrollProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'header';
  stagger?: number;
};

const easing = [0.22, 1, 0.36, 1] as const;

function RevealOnScroll({
  children,
  delay = 0,
  y = 24,
  duration = 0.55,
  className,
  as = 'div',
  stagger,
}: RevealOnScrollProps) {
  const Tag = motion[as];

  if (stagger !== undefined) {
    const containerVariants: Variants = {
      hidden: {},
      visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
    };

    return (
      <Tag
        className={className}
        initial="hidden"
        variants={containerVariants}
        viewport={{ once: true, margin: '-80px' }}
        whileInView="visible"
      >
        {children}
      </Tag>
    );
  }

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      transition={{ delay, duration, ease: easing }}
      viewport={{ once: true, margin: '-80px' }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </Tag>
  );
}

export default RevealOnScroll;
