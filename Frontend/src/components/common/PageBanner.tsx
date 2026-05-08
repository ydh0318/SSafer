import type { ReactNode } from 'react';

import InlineMessage from './InlineMessage';

type PageBannerTone = 'success' | 'error' | 'warning' | 'info';

type PageBannerProps = {
  message: ReactNode;
  tone?: PageBannerTone;
  className?: string;
};

function PageBanner({ message, tone = 'info', className = '' }: PageBannerProps) {
  return <InlineMessage className={`px-5 py-4 ${className}`.trim()} message={message} tone={tone} />;
}

export default PageBanner;
