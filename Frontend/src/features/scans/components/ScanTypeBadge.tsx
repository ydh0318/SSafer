import { Shield, ShieldAlert } from 'lucide-react';

import type { ScanType } from '../../../types/scan';
import { getSafeScanType, getScanTypeLabel } from '../utils/scanPresentation';

type ScanTypeBadgeProps = {
  scanType?: ScanType | null;
};

function ScanTypeBadge({ scanType }: ScanTypeBadgeProps) {
  const safeScanType = getSafeScanType(scanType);
  const Icon = safeScanType === 'SERVER_AUDIT' ? ShieldAlert : Shield;
  const className =
    safeScanType === 'SERVER_AUDIT'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-sky-200 bg-sky-50 text-sky-800';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      {getScanTypeLabel(safeScanType)}
    </span>
  );
}

export default ScanTypeBadge;
