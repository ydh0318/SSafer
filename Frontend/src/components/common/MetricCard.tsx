type MetricTone = 'plain' | 'red' | 'orange' | 'amber' | 'sky' | 'green';

const toneClass: Record<MetricTone, string> = {
  plain: 'border-slate-200 bg-white',
  red: 'border-red-100 bg-red-50',
  orange: 'border-orange-100 bg-orange-50',
  amber: 'border-amber-100 bg-amber-50',
  sky: 'border-sky-100 bg-sky-50',
  green: 'border-emerald-100 bg-emerald-50',
};

type MetricCardProps = {
  label: string;
  value: string | number;
  helper: string;
  tone?: MetricTone;
};

function MetricCard({ label, value, helper, tone = 'plain' }: MetricCardProps) {
  return (
    <article className={`border p-5 shadow-sm transition hover:-translate-y-0.5 ${toneClass[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-3 text-xs leading-6 text-slate-500">{helper}</p>
    </article>
  );
}

export default MetricCard;
