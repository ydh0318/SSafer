import { Bot, Terminal, Upload } from 'lucide-react';

import type { ScanMode, ScanRequestSource } from '../../../types/scan';
import { getScanModeClassName, getScanModeLabel } from '../utils/scanPresentation';

type ScanModeBadgeProps = {
  scanMode: ScanMode;
  source?: ScanRequestSource | null;
};

function ScanModeBadge({ scanMode, source }: ScanModeBadgeProps) {
  const Icon = scanMode === 'UPLOAD' ? Upload : source === 'CLI' ? Terminal : Bot;
  const className = getScanModeClassName(scanMode, source);

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      {getScanModeLabel(scanMode, source)}
    </span>
  );
}

export default ScanModeBadge;
