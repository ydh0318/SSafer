import { DomainBadge, MethodBadge, TokenBadge } from '../../../components/common/Badge';
import { getApisByScreen, type ScreenId } from '../../../constants/apiSpecs';

type ApiEndpointListProps = {
  screenId: ScreenId;
  compact?: boolean;
};

function ApiEndpointList({ screenId, compact = false }: ApiEndpointListProps) {
  const apis = getApisByScreen(screenId);

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">API Branch</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">이 화면의 API</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{apis.length} endpoints</span>
      </div>

      <div className={`mt-4 space-y-2 ${compact ? 'max-h-[34rem] overflow-auto pr-1' : ''}`}>
        {apis.map((api) => (
          <article key={`${api.method}-${api.path}-${api.feature}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <DomainBadge value={api.domain} />
              <TokenBadge value={api.token} />
              <MethodBadge value={api.method} />
            </div>
            <p className="mt-2 text-sm font-black text-slate-900">{api.feature}</p>
            <p className="mt-1 break-all font-mono text-xs leading-5 text-slate-500">{api.path}</p>
          </article>
        ))}
      </div>
    </aside>
  );
}

export default ApiEndpointList;
