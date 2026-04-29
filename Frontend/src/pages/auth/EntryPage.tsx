import { AlertCircle, GitBranch, LoaderCircle, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { TokenBadge } from '../../components/common/Badge';
import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
import ApiEndpointList from '../../features/api-specs/components/ApiEndpointList';
import { enterGuestMode } from '../../features/auth/api/guest';
import { useAuthStore } from '../../store/authStore';

function EntryPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [guestPending, setGuestPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGuestEntry = async () => {
    setGuestPending(true);
    setErrorMessage(null);

    try {
      const session = await enterGuestMode();

      login({
        accessToken: session.guestAccessToken,
        user: {
          id: `guest:${session.expiresAt}`,
          email: 'guest@ssafer.local',
          name: 'Guest Workspace',
          role: 'GUEST',
        },
      });

      navigate(ROUTES.projects);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '게스트 세션 발급에 실패했습니다.');
    } finally {
      setGuestPending(false);
    }
  };

  const handlePreviewEntry = () => {
    login({
      accessToken: 'oauth-preview-token',
      user: {
        id: 'preview-user',
        email: 'demo@ssafer.app',
        name: 'OAuth Preview User',
        role: 'USER',
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
            Entry API flow
          </div>
          <h2 className="mt-6 max-w-3xl text-4xl font-black leading-tight md:text-5xl">
            게스트 진입부터 인증 확장까지 같은 진입 화면에서 바로 테스트할 수 있습니다.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
            지금은 게스트 모드 진입을 실제 API와 연결하고, 나머지 로그인 분기는 이후 단계에서 같은 구조로 확장할 수
            있게 유지합니다.
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={guestPending}
              onClick={handleGuestEntry}
              type="button"
            >
              {guestPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              게스트로 시작
            </button>
            <button
              className="rounded-lg bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700"
              onClick={handlePreviewEntry}
              type="button"
            >
              일반 로그인 미리보기
            </button>
            <button
              className="rounded-lg bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700"
              onClick={handlePreviewEntry}
              type="button"
            >
              OAuth 미리보기
            </button>
          </div>
          {errorMessage ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : null}
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <FlowCard
            desc="POST /api/v1/guests/enter 호출 후 O/G 권한이 필요한 프로젝트 API까지 이어집니다."
            icon={<ShieldCheck className="h-5 w-5" />}
            title="게스트 세션 발급"
            token="X"
          />
          <FlowCard
            desc="이메일 인증, 회원가입, 비밀번호 기반 로그인 흐름을 같은 진입 구조에 확장할 수 있습니다."
            icon={<Mail className="h-5 w-5" />}
            title="이메일 인증 확장"
            token="X"
          />
          <FlowCard
            desc="액세스 토큰이 만료되면 인터셉터가 재발급 API를 호출해 같은 요청을 한 번 더 시도합니다."
            icon={<RefreshCw className="h-5 w-5" />}
            title="토큰 재시도"
            token="X"
          />
          <FlowCard
            desc="Google OAuth 버튼은 그대로 유지해 다음 단계에서 동일한 진입 UI에 연결할 수 있습니다."
            icon={<Mail className="h-5 w-5" />}
            title="Google OAuth"
            token="X"
          />
          <FlowCard
            desc="Github OAuth도 동일한 진입 컴포넌트 구조를 재사용할 수 있도록 분리된 CTA로 유지합니다."
            icon={<GitBranch className="h-5 w-5" />}
            title="Github OAuth"
            token="X"
          />
        </div>

        <SectionPanel
          description="엔트리 화면에서는 인증 방식이 달라도 동일한 버튼 구조와 상태 처리 방식을 재사용합니다."
          eyebrow="Entry branches"
          title="진입 분기"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {[
              '게스트 세션 발급 후 프로젝트 목록 이동',
              '이메일 인증 및 일반 로그인 확장',
              'OAuth 로그인 버튼 재사용',
              '토큰 만료 시 인터셉터 재시도',
            ].map((item) => (
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
