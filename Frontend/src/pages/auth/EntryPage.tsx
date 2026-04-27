import { GitBranch, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { TokenBadge } from '../../components/common/Badge';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
import ApiEndpointList from '../../features/api-specs/components/ApiEndpointList';
import { useAuthStore } from '../../store/authStore';

function EntryPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const enterWorkspace = (mode: 'guest' | 'user') => {
    login({
      accessToken: `${mode}-preview-token`,
      user: {
        id: mode === 'guest' ? 'guest-1' : 'user-1',
        email: mode === 'guest' ? 'guest@ssafer.local' : 'demo@ssafer.app',
        name: mode === 'guest' ? 'Guest Workspace' : 'Demo User',
        role: mode === 'guest' ? 'GUEST' : 'USER',
      },
    });

    navigate(ROUTES.projects);
  };

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6">
        <section className="rounded-lg bg-slate-950 p-6 text-white shadow-sm md:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-slate-200">
            <ShieldCheck className="h-4 w-4" />
            API 토큰 분기 기준 반영
          </div>
          <h2 className="mt-6 max-w-3xl text-4xl font-black leading-tight md:text-5xl">
            게스트로 바로 점검하거나 계정으로 프로젝트를 관리합니다.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
            게스트 진입, 회원가입, 이메일 인증, 자체 로그인, Google/Github OAuth, 토큰 재발급을 한 화면에서 분리해 보여줍니다.
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <button className="rounded-lg bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-200" onClick={() => enterWorkspace('guest')} type="button">
              게스트 모드 진입
            </button>
            <button className="rounded-lg bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700" onClick={() => enterWorkspace('user')} type="button">
              자체 로그인
            </button>
            <button className="rounded-lg bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700" onClick={() => enterWorkspace('user')} type="button">
              OAuth 로그인
            </button>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <FlowCard
            desc="POST /api/v1/guests/enter 호출 후 O/G API 사용 가능"
            icon={<ShieldCheck className="h-5 w-5" />}
            title="게스트"
            token="X"
          />
          <FlowCard desc="중복 확인, 코드 전송, 코드 확인, 가입 순서로 진행" icon={<Mail className="h-5 w-5" />} title="회원가입 / 이메일 인증" token="X" />
          <FlowCard desc="access token 만료 시 refresh endpoint로 재발급" icon={<RefreshCw className="h-5 w-5" />} title="로그인 / 토큰 재발급" token="X" />
          <FlowCard desc="Google OAuth 로그인 진입과 계정 연결 기반" icon={<Mail className="h-5 w-5" />} title="Google OAuth" token="X" />
          <FlowCard desc="Github OAuth 로그인 진입과 계정 연결 기반" icon={<GitBranch className="h-5 w-5" />} title="Github OAuth" token="X" />
        </div>

        <SectionPanel description="초기 화면에서 가능한 모든 비로그인 API를 기능 단위로 나눕니다." eyebrow="Entry branches" title="인증 진입 분기">
          <div className="grid gap-3 md:grid-cols-2">
            {['게스트 모드 진입', '회원가입', '이메일 인증', '자체 로그인', 'Google/Github OAuth 로그인', '토큰 재발급'].map((item) => (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700" key={item}>
                {item}
              </div>
            ))}
          </div>
        </SectionPanel>
      </div>

      <ApiEndpointList compact screenId="entry" />
    </div>
  );
}

function FlowCard({ title, desc, token, icon }: { title: string; desc: string; token: 'X'; icon: ReactNode }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700">{icon}</div>
        <TokenBadge value={token} />
      </div>
      <h3 className="mt-4 text-xl font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
    </article>
  );
}

export default EntryPage;
