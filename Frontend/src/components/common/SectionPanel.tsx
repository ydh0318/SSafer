import type { PropsWithChildren, ReactNode } from 'react';

type SectionPanelProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}>;

function SectionPanel({ title, eyebrow, description, action, className = '', children }: SectionPanelProps) {
  return (
    <section className={`border border-slate-200 bg-white p-5 shadow-sm md:p-6 ${className}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">{eyebrow}</p> : null}
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{title}</h2>
          {description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default SectionPanel;
