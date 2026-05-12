import { Bot, Terminal, Upload } from 'lucide-react';

import type { ScanMode } from '../../../types/scan';
import { getScanModeClassName, getScanModeLabel } from '../utils/scanPresentation';

type ScanModeBadgeProps = {
  scanMode: ScanMode;
};

const modeIconMap: Record<ScanMode, React.ElementType> = {
  AGENT: Bot,
  CLI: Terminal,
  UPLOAD: Upload,
};

function ScanModeBadge({ scanMode }: ScanModeBadgeProps) {
  const Icon = modeIconMap[scanMode] ?? Terminal;
  const className = getScanModeClassName(scanMode);

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      {getScanModeLabel(scanMode)}
    </span>
  );
}

export default ScanModeBadge;
