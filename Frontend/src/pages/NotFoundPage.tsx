import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';

function NotFoundPage() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">404</p>
      <h2 className="mt-3 text-4xl font-semibold text-white">Page Not Found</h2>
      <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
        요청하신 페이지를 찾을 수 없습니다. 라우터 구조 확인 중이라면 프로젝트 목록으로 돌아가서
        경로 연결을 다시 확인해보세요.
      </p>
      <Link
        className="mt-8 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
        to={ROUTES.projects}
      >
        Go to Projects
      </Link>
    </section>
  );
}

export default NotFoundPage;
