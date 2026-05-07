import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ROUTES } from '../../constants/routes';
import { loginWithOAuth, connectGithubSocialAccount, connectGoogleSocialAccount } from '../../features/auth/api/member';
import {
  getOAuthLoginCancelledMessage,
  getOAuthLoginErrorMessage,
} from '../../features/auth/utils/authError';
import {
  getOAuthProviderLabel,
  getOAuthRedirectUri,
  resolveOAuthCallbackIntent,
  setOAuthResultMessage,
} from '../../features/auth/utils/oauth';
import { useAuthStore } from '../../store/authStore';
import type { ApiErrorResponse } from '../../types/api';
import type { OAuthProvider, RejoinRequiredData } from '../../types/auth';

type OAuthCallbackPageProps = {
  provider: OAuthProvider;
};

function OAuthCallbackPage({ provider }: OAuthCallbackPageProps) {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [searchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasProcessedRef = useRef(false);
  const providerLabel = getOAuthProviderLabel(provider);

  useEffect(() => {
    if (hasProcessedRef.current) {
      return;
    }

    hasProcessedRef.current = true;

    const code = searchParams.get('code')?.trim();
    const providerError = searchParams.get('error');
    const state = searchParams.get('state');
    const intent = resolveOAuthCallbackIntent(provider, state);

    if (providerError || !code || !intent) {
      setErrorMessage(getOAuthLoginCancelledMessage(provider));
      return;
    }

    const redirectUri = getOAuthRedirectUri(provider);

    const runOAuthLogin = async () => {
      try {
        const result = await loginWithOAuth({
          provider,
          authorizationCode: code,
          redirectUri,
        });

        login({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken ?? null,
          user: {
            id: String(result.userId),
            email: result.email,
            name: result.displayName,
            role: 'USER',
          },
        });

        if (result.newUserCreated) {
          setOAuthResultMessage(`${providerLabel} 계정으로 회원가입과 로그인이 완료되었습니다.`);
        } else {
          setOAuthResultMessage(`${providerLabel} 로그인에 성공했습니다.`);
        }

        navigate(ROUTES.dashboard, { replace: true });
      } catch (error) {
        if (
          axios.isAxiosError<ApiErrorResponse<RejoinRequiredData>>(error) &&
          error.response?.data?.code === 'REJOIN_REQUIRED' &&
          error.response.data.data?.rejoinToken
        ) {
          const confirmed = window.confirm('탈퇴한 계정입니다. 재가입 후 로그인하시겠습니까?');

          if (!confirmed) {
            setErrorMessage('재가입 확인이 취소되었습니다.');
            return;
          }

          try {
            const result = await loginWithOAuth({
              provider,
              confirmRejoin: true,
              rejoinToken: error.response.data.data.rejoinToken,
            });

            login({
              accessToken: result.accessToken,
              refreshToken: result.refreshToken ?? null,
              user: {
                id: String(result.userId),
                email: result.email,
                name: result.displayName,
                role: 'USER',
              },
            });

            setOAuthResultMessage(`${providerLabel} 계정으로 재가입 후 로그인이 완료되었습니다.`);
            navigate(ROUTES.dashboard, { replace: true });
            return;
          } catch (rejoinError) {
            setErrorMessage(getOAuthLoginErrorMessage(rejoinError, provider));
            return;
          }
        }

        setErrorMessage(getOAuthLoginErrorMessage(error, provider));
      }
    };

    const runSocialConnect = async () => {
      try {
        if (provider === 'GOOGLE') {
          await connectGoogleSocialAccount({
            authorizationCode: code,
            redirectUri,
          });
        } else {
          await connectGithubSocialAccount({
            authorizationCode: code,
            redirectUri,
          });
        }

        setOAuthResultMessage(`${providerLabel} 계정 연결이 완료되었습니다.`);
        navigate(ROUTES.settings, { replace: true });
      } catch (error) {
        setErrorMessage(getOAuthLoginErrorMessage(error, provider));
      }
    };

    void (intent === 'connect' ? runSocialConnect() : runOAuthLogin());
  }, [login, navigate, provider, providerLabel, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5] px-6">
      <div className="w-full max-w-xl rounded-[32px] border border-neutral-200 bg-white px-8 py-12 text-center shadow-[0_24px_90px_rgba(0,0,0,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-400">
          OAuth Callback
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-black">
          {errorMessage ? '로그인 또는 연결에 실패했습니다' : `${providerLabel} 계정을 확인하는 중입니다`}
        </h1>
        <p className="mt-4 text-base leading-7 text-neutral-600">
          {errorMessage ?? '인가 코드를 확인하고 서비스 계정 연결 또는 로그인 처리를 진행하고 있습니다.'}
        </p>
        <div className="mt-8">
          <button
            className="inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
            onClick={() => navigate(ROUTES.login, { replace: true })}
            type="button"
          >
            로그인 화면으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}

export default OAuthCallbackPage;
