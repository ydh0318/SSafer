import type { CSSProperties, ReactNode } from 'react';

import { FEATURE_THEME } from '../../constants/featureTheme';

type FeatureBannerProps = {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

function FeatureBanner({ eyebrow, title, description, actions, aside, className = '', style }: FeatureBannerProps) {
  return (
    <section
      className={`theme-dark-soft-card overflow-hidden border border-[color:var(--feature-hairline)] bg-[color:var(--feature-card)] ${className}`.trim()}
      style={
        {
          '--feature-hairline': FEATURE_THEME.hairline,
          '--feature-card': FEATURE_THEME.card,
          ...style,
        } as CSSProperties
      }
    >
      <div className="grid gap-8 px-6 py-8 md:px-8 md:py-10 xl:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)] xl:items-end">
        <div>
          <p className="text-[11px] font-mono font-bold uppercase tracking-[0.32em] text-neutral-400">{eyebrow}</p>
          <div className="mt-4 text-[color:var(--feature-ink,#0F0F0F)]">{title}</div>
          {description ? <div className="mt-5 max-w-3xl text-base leading-8 text-neutral-600">{description}</div> : null}
          {actions ? <div className="mt-7 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="xl:justify-self-end">{aside}</div> : null}
      </div>
    </section>
  );
}

export default FeatureBanner;
