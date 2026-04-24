import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

function ProjectListPage() {
  const exampleProjectId = 'project-1';

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">Projects</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Project List Page</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          프로젝트 목록, 생성 버튼, 검색 필터가 들어갈 자리입니다. 현재는 라우터 연결 확인을 위한
          기본 페이지입니다.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-sm text-slate-400">Example Project</p>
        <h3 className="mt-2 text-xl font-semibold text-white">SSAFER Demo Project</h3>
        <Link
          className="mt-4 inline-flex rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
          to={ROUTES.projectDetail.replace(':projectId', exampleProjectId)}
        >
          Go to Project Detail
        </Link>
      </div>
    </section>
  );
}

export default ProjectListPage;
