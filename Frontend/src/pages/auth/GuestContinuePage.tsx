import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import { useAuthStore } from '../../store/authStore';

function parseJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('유효하지 않은 토큰 형식입니다.');
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4 ? '='.repeat(4 - (base64.length % 4)) : '';
  return JSON.parse(atob(base64 + padding));
}

export default function GuestContinuePage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  useEffect(() => {
    const token = searchParams.get('token');

    // URL에서 토큰 즉시 제거 — 브라우저 히스토리/로그 노출 방지
    window.history.replaceState({}, '', ROUTES.guestContinue);

    if (!token) {
      navigate(ROUTES.root, { replace: true });
      return;
    }

    try {
      const payload = parseJwtPayload(token);

      const exp = typeof payload.exp === 'number' ? payload.exp : null;
      if (!exp) throw new Error('토큰에 만료 정보가 없습니다.');

      if (Date.now() > exp * 1000) {
        setErrorMessage('토큰이 만료되었습니다. CLI에서 새 게스트 세션을 발급해 주세요.');
        return;
      }

      const expiresAt = new Date(exp * 1000).toISOString();

      login({
        accessToken: token,
        refreshToken: null,
        user: {
          id: `guest:${expiresAt}`,
          email: 'guest@ssafer.local',
          name: 'Guest User',
          role: 'GUEST',
        },
      });

      navigate(ROUTES.dashboard, { replace: true });
    } catch {
      setErrorMessage('유효하지 않은 토큰입니다. CLI에서 발급한 게스트 토큰을 확인해 주세요.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (errorMessage) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#1A1A1A] px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-red-900/50 bg-[#2A1A1A] p-8 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-red-400">토큰 오류</p>
          <p className="mt-4 text-base text-neutral-300">{errorMessage}</p>
          <button
            className="mt-8 rounded-full bg-neutral-700 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-neutral-600"
            onClick={() => navigate(ROUTES.root, { replace: true })}
            type="button"
          >
            처음으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#1A1A1A]">
      <p className="text-sm font-bold tracking-widest text-neutral-500">게스트 세션 연결 중...</p>
    </div>
  );
}
