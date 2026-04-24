import { Link, useParams } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';

function ScanDetailPage() {
  const { scanId } = useParams<{ scanId: string }>();

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">Scans</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Scan Detail Page</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          현재 선택된 스캔 ID는 <span className="text-slate-200">{scanId}</span> 입니다.
        </p>
      </div>

      <Link
        className="inline-flex rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
        to={ROUTES.resultDetail.replace(':scanId', scanId ?? 'scan-1')}
      >
        Go to Result Page
      </Link>
    </section>
  );
}

export default ScanDetailPage;
