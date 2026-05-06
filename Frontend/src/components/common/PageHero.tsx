import type { ReactNode } from 'react';

type PageHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
};

function PageHero({ eyebrow, title, description, actions, aside }: PageHeroProps) {
  return (
    <section className="theme-page-hero theme-dark-soft-card overflow-hidden border border-neutral-200 bg-[linear-gradient(135deg,#fafafa_0%,#f2f2f2_52%,#ebebeb_100%)]">
      <div className="grid gap-8 px-6 py-8 md:px-8 md:py-10 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)] xl:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-neutral-500">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-black md:text-5xl md:leading-[0.95]">
            {title}
          </h1>
          <div className="mt-5 max-w-3xl text-base leading-8 text-neutral-600">{description}</div>
          {actions ? <div className="mt-7 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="xl:justify-self-end">{aside}</div> : null}
      </div>
    </section>
  );
}

export default PageHero;
