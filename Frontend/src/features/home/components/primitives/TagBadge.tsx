import type { ReactNode } from 'react';

type TagBadgeTone = 'dark' | 'accent' | 'outline';

type TagBadgeProps = {
  children: ReactNode;
  tone?: TagBadgeTone;
  className?: string;
};

const toneClass: Record<TagBadgeTone, string> = {
  dark: 'bg-[#111111] text-white',
  accent: 'bg-[#D4FC64] text-[#0F0F0F]',
  outline: 'border border-[#111111] text-[#111111]',
};

function TagBadge({ children, tone = 'dark', className = '' }: TagBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1.5 text-[10px] font-mono font-bold tracking-[0.18em] uppercase ${toneClass[tone]} ${className}`.trim()}
      style={{ borderRadius: 'var(--radius-landing-badge)' }}
    >
      {children}
    </span>
  );
}

export default TagBadge;
