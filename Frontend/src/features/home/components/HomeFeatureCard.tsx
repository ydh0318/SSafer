import type { ReactNode } from 'react';

type HomeFeatureCardProps = {
  step: string;
  title: ReactNode;
  description: ReactNode;
  className?: string;
  titleClassName?: string;
};

function HomeFeatureCard({ step, title, description, className = '', titleClassName = '' }: HomeFeatureCardProps) {
  return (
    <article
      className={`theme-dark-soft-card border border-black/5 bg-white p-7 shadow-[0_20px_45px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-1 ${className}`.trim()}
    >
      <p className="text-3xl font-light tracking-tight text-neutral-400">{step}</p>
      <h3 className={`mt-10 text-2xl font-black tracking-tight text-[#020617] md:text-[2rem] ${titleClassName}`.trim()}>{title}</h3>
      <p className="mt-6 text-xl leading-9 text-neutral-500">{description}</p>
    </article>
  );
}

export default HomeFeatureCard;
