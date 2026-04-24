import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import { useAuthStore } from '../../store/authStore';

function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleDemoLogin = () => {
    login({
      accessToken: 'demo-access-token',
      user: {
        id: '1',
        email: 'demo@ssafer.app',
        name: 'Demo User',
        role: 'USER',
      },
    });

    navigate(ROUTES.projects);
  };

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-slate-950/40">
      <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">Auth</p>
      <h2 className="mt-3 text-3xl font-semibold text-white">Login Page</h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        라우터 구조 확인용 임시 로그인 페이지입니다. 실제 로그인 폼 연결 전까지는 데모 로그인
        버튼으로 보호 라우트를 확인할 수 있습니다.
      </p>

      <button
        className="mt-8 w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
        onClick={handleDemoLogin}
        type="button"
      >
        Demo Login
      </button>
    </section>
  );
}

export default LoginPage;
