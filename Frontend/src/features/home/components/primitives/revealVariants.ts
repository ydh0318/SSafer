import type { Variants } from 'framer-motion';

const easing = [0.22, 1, 0.36, 1] as const;

export const revealItemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easing } },
};
