import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type QuickActionCardProps = {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};

function QuickActionCard({ icon: Icon, title, description, onClick, disabled }: QuickActionCardProps) {
  return (
    <motion.button
      className={`group flex w-full flex-col items-start gap-5 border border-neutral-200/60 bg-white/20 p-6 text-left backdrop-blur-sm transition-all duration-300 landing-card-radius ${
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'hover:-translate-y-1 hover:border-[#0F0F0F]/40 hover:bg-white/60 hover:shadow-[0_18px_44px_rgba(15,23,42,0.08)]'
      }`}
      disabled={disabled}
      initial={{ opacity: 0, y: 12 }}
      onClick={onClick}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      type="button"
      viewport={{ once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="inline-flex h-12 w-12 items-center justify-center bg-white shadow-[0_2px_8px_rgba(15,23,42,0.06)] landing-inner-radius">
        <Icon className="h-5 w-5 text-[#0F0F0F]" />
      </div>
      <div>
        <h3 className="text-base font-black tracking-tight text-[#0F0F0F]">{title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">{description}</p>
      </div>
    </motion.button>
  );
}

export default QuickActionCard;
