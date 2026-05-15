import { CheckCircle, FileText } from 'lucide-react';

import type { ScanMode } from '../../../types/scan';

type PatchAvailabilityBadgeProps = {
  hasPatches: boolean;
  scanMode?: ScanMode | null;
};

function PatchAvailabilityBadge({ hasPatches, scanMode }: PatchAvailabilityBadgeProps) {
  if (hasPatches && scanMode === 'AGENT') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
        <CheckCircle className="h-3.5 w-3.5" />
        자동 수정 가능
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-bold text-neutral-600">
      <FileText className="h-3.5 w-3.5" />
      가이드만 제공
    </span>
  );
}

export default PatchAvailabilityBadge;