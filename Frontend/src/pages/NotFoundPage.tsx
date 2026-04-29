import { Link } from 'react-router-dom';

import { ROUTES } from '../constants/routes';

function NotFoundPage() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center bg-slate-100 px-6 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">404</p>
      <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Page Not Found</h2>
      <p className="mt-4 max-w-md text-sm leading-6 text-slate-500">
        요청한 화면을 찾을 수 없습니다. 시작 화면으로 돌아가 다시 확인해 주세요.
      </p>
      <Link
        className="mt-8 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
        to={ROUTES.root}
      >
        시작 화면으로 이동
      </Link>
    </section>
  );
}

export default NotFoundPage;
