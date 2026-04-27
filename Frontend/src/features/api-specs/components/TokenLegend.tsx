import { TokenBadge } from '../../../components/common/Badge';
import { TOKEN_LABELS, type TokenRequirement } from '../../../constants/apiSpecs';

const tokenOrder: TokenRequirement[] = ['X', 'O', 'O/G', 'INTERNAL'];

function TokenLegend() {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">토큰 분기 기준</p>
      <div className="mt-3 space-y-2">
        {tokenOrder.map((token) => (
          <div key={token} className="flex items-center gap-2 text-xs text-slate-600">
            <TokenBadge value={token} />
            <span>{TOKEN_LABELS[token]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TokenLegend;
