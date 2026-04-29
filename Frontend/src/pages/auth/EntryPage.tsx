import { AlertCircle, LoaderCircle, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import SectionPanel from '../../components/common/SectionPanel';
import { ROUTES } from '../../constants/routes';
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
      setErrorMessage(
        error instanceof Error ? error.message : '게스트 세션 발급에 실패했습니다.',
      );
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
        name: 'Preview User',
        role: 'USER',
      },
    });

    navigate(ROUTES.projects);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-slate-950 p-6 text-white shadow-sm md:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-slate-200">
          <ShieldCheck className="h-4 w-4" />
          Secure onboarding
        </div>
        <h2 className="mt-6 max-w-3xl text-4xl font-black leading-tight md:text-5xl">
          환경 점검을 빠르게 시작하고
          <br />
          프로젝트 단위로 결과를 관리하세요.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
          게스트 모드로 바로 체험할 수 있고, 이후 로그인 흐름으로 자연스럽게 확장할 수 있습니다.
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
            미리보기로 둘러보기
          </button>
          <button
            className="rounded-lg bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700"
            onClick={handlePreviewEntry}
            type="button"
          >
            로그인 화면 미리보기
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
        <FeatureCard
          description="프로젝트 단위로 스캔을 만들고 결과를 이어서 관리할 수 있습니다."
          icon={<Sparkles className="h-5 w-5" />}
          title="빠른 시작"
        />
        <FeatureCard
          description="게스트 모드에서도 핵심 흐름을 먼저 체험하고 필요할 때 로그인으로 전환할 수 있습니다."
          icon={<UserRound className="h-5 w-5" />}
          title="유연한 접근"
        />
        <FeatureCard
          description="생성된 프로젝트와 스캔 결과는 이후 상세 화면에서 바로 이어서 확인할 수 있습니다."
          icon={<ShieldCheck className="h-5 w-5" />}
          title="연속된 작업"
        />
      </div>

      <SectionPanel
        description="처음 진입한 사용자가 바로 이해할 수 있도록 핵심 흐름만 간단히 안내합니다."
        eyebrow="Getting started"
        title="시작 순서"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {[
            '게스트 모드 또는 로그인으로 서비스에 진입합니다.',
            '프로젝트를 생성하고 설명과 기본 스캔 방식을 설정합니다.',
            '원하는 방식으로 스캔을 요청합니다.',
            '결과와 상세 취약점을 검토합니다.',
          ].map((item) => (
            <div
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700"
              key={item}
            >
              {item}
            </div>
          ))}
        </div>
      </SectionPanel>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700">
        {icon}
      </div>
      <h3 className="mt-4 text-xl font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </article>
  );
}

export default EntryPage;
