import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

type AppBrandProps = {
  className?: string;
  to: string;
  subtitle?: string;
  title?: string;
  titleClassName?: string;
  textClassName?: string;
  linkClassName?: string;
  subtitleClassName?: string;
};

function AppBrand({
  className = '',
  to,
  subtitle = 'SSAFER',
  title = 'SSAFER.io',
  titleClassName = 'text-xl font-black tracking-normal',
  textClassName = '',
  linkClassName = 'text-black',
  subtitleClassName = 'block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b7f6a]',
}: AppBrandProps) {
  return (
    <Link className={`site-brand inline-flex items-center gap-3 ${linkClassName} ${className}`.trim()} to={to}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-black text-white">
        <Shield className="h-5 w-5" />
      </span>
      <span className={`site-brand-copy min-w-0 ${textClassName}`.trim()}>
        <span className={subtitleClassName}>{subtitle}</span>
        <span className={titleClassName}>{title}</span>
      </span>
    </Link>
  );
}

export default AppBrand;
