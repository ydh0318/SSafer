import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

type AppBrandProps = {
  className?: string;
  showSubtitle?: boolean;
  to: string;
  subtitle?: string;
  title?: string;
  titleClassName?: string;
  textClassName?: string;
};

function AppBrand({
  className = '',
  showSubtitle = true,
  to,
  subtitle = 'SSAFER',
  title = 'SSAFER.io',
  titleClassName = 'text-xl font-black tracking-normal',
  textClassName = '',
}: AppBrandProps) {
  return (
    <Link className={`site-brand inline-flex items-center gap-3 text-black ${className}`.trim()} to={to}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-black text-white">
        <Shield className="h-5 w-5" />
      </span>
      <span className={`site-brand-copy min-w-0 ${textClassName}`.trim()}>
        {showSubtitle ? (
          <span className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b7f6a]">{subtitle}</span>
        ) : null}
        <span className={titleClassName}>{title}</span>
      </span>
    </Link>
  );
}

export default AppBrand;
