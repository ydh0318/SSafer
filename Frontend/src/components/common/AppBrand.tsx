import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

type AppBrandProps = {
  to: string;
  subtitle?: string;
  title?: string;
  titleClassName?: string;
  textClassName?: string;
};

function AppBrand({
  to,
  subtitle = 'SSAFER',
  title = 'SSAFER.io',
  titleClassName = 'text-xl font-black tracking-normal',
  textClassName = '',
}: AppBrandProps) {
  return (
    <Link className="site-brand inline-flex items-center gap-3 text-black" to={to}>
      <span className="grid h-10 w-10 place-items-center bg-black text-white">
        <Shield className="h-5 w-5" />
      </span>
      <span className={`site-brand-copy ${textClassName}`.trim()}>
        <span className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b7f6a]">
          {subtitle}
        </span>
        <span className={titleClassName}>{title}</span>
      </span>
    </Link>
  );
}

export default AppBrand;
