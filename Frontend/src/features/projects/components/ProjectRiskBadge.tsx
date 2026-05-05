import type { RiskLevel } from '../../../mocks/ssaferMockData';

type ProjectRiskBadgeProps = {
  risk: RiskLevel;
};

const toneByRisk: Record<RiskLevel, string> = {
  CRITICAL: 'border-rose-200 bg-rose-50 text-rose-700',
  HIGH: 'border-orange-200 bg-orange-50 text-orange-700',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700',
  LOW: 'border-sky-200 bg-sky-50 text-sky-700',
};

const labelByRisk: Record<RiskLevel, string> = {
  CRITICAL: 'Critical Risk',
  HIGH: 'High Risk',
  MEDIUM: 'Medium Risk',
  LOW: 'Low Risk',
};

function ProjectRiskBadge({ risk }: ProjectRiskBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold tracking-[0.08em] ${toneByRisk[risk]}`}
    >
      {labelByRisk[risk]}
    </span>
  );
}

export default ProjectRiskBadge;
