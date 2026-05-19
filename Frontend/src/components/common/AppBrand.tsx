import { Link } from 'react-router-dom';

type AppBrandProps = {
  className?: string;
  to: string;
  title?: string;
  titleClassName?: string;
  textClassName?: string;
  linkClassName?: string;
  /** 거위 아이콘 감싸는 wrapper의 className. 기본값은 라이트 모드용 검정 박스. */
  iconWrapperClassName?: string;
};

const DEFAULT_ICON_WRAPPER =
  'grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-black p-1.5';

function AppBrand({
  className = '',
  to,
  title = 'SSAFER',
  titleClassName = 'text-xl font-black tracking-normal',
  textClassName = '',
  linkClassName = 'text-black',
  iconWrapperClassName = DEFAULT_ICON_WRAPPER,
}: AppBrandProps) {
  return (
    <Link className={`site-brand inline-flex items-center gap-3 ${linkClassName} ${className}`.trim()} to={to}>
      <span className={iconWrapperClassName}>
        <img
          alt=""
          className="h-full w-full select-none object-contain"
          draggable={false}
          src="/landing/ssafer_goose.png"
        />
      </span>
      <span className={`site-brand-copy min-w-0 ${textClassName}`.trim()}>
        <span className={titleClassName}>{title}</span>
      </span>
    </Link>
  );
}

export default AppBrand;
