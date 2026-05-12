import { CheckCircle, FileText } from 'lucide-react';

type PatchAvailabilityBadgeProps = {
  hasPatches: boolean;
};

/**
 * finding.fix.patches 유무에 따라 "자동 수정 가능" 또는 "가이드만 제공" 배지를 렌더링합니다.
 * CLI 스캔과 웹 업로드 스캔의 결과 차이를 사용자에게 명확히 안내하는 용도로 사용합니다.
 */
function PatchAvailabilityBadge({ hasPatches }: PatchAvailabilityBadgeProps) {
  if (hasPatches) {
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
