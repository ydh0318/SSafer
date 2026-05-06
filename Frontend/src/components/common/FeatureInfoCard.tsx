import type { ReactNode } from 'react';

type FeatureInfoCardProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  tone?: 'default' | 'dark' | 'accent' | 'danger' | 'success';
  className?: string;
};

const toneClass = {
  default: 'theme-dark-soft-card bg-white text-[#0F0F0F] border border-black/5',
  dark: 'theme-dark-panel bg-[#111111] text-white',
  accent: 'bg-[#D4FC64] text-[#0F0F0F]',
  danger: 'bg-[#FFE5E5] text-[#7A1111]',
  success: 'bg-[#E9F8EE] text-[#0A8F4E]',
} as const;

function FeatureInfoCard({
  eyebrow,
  title,
  description,
  footer,
  tone = 'default',
  className = '',
}: FeatureInfoCardProps) {
  return (
    <article className={`${toneClass[tone]} p-6 shadow-[0_14px_30px_rgba(15,15,15,0.04)] ${className}`.trim()}>
      {eyebrow ? <p className="text-[11px] font-mono uppercase tracking-[0.28em] opacity-70">{eyebrow}</p> : null}
      <div className="mt-3">{title}</div>
      {description ? <div className="mt-3 text-sm leading-7 opacity-80">{description}</div> : null}
      {footer ? <div className="mt-5">{footer}</div> : null}
    </article>
  );
}

export default FeatureInfoCard;
