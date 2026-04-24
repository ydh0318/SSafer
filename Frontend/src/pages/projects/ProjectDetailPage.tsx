import { Link, useParams } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';

function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">Projects</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Project Detail Page</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          현재 선택된 프로젝트 ID는 <span className="text-slate-200">{projectId}</span> 입니다.
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
          to={ROUTES.scanDetail.replace(':scanId', 'scan-1')}
        >
          Go to Scan Detail
        </Link>
        <Link
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
          to={ROUTES.projects}
        >
          Back to Projects
        </Link>
      </div>
    </section>
  );
}

export default ProjectDetailPage;
