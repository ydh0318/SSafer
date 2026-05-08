import axios from 'axios';
import { LoaderCircle, Link2, Unlink2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { getApiErrorCode } from '../../../api/error';
import type { OAuthProvider, SocialAccount } from '../../../types/auth';
import {
  disconnectGithubSocialAccount,
  disconnectGoogleSocialAccount,
  getConnectedSocialAccounts,
} from '../api/member';
import { getOAuthConfigMissingMessage } from '../utils/authError';
import {
  buildOAuthStartUrl,
  consumeOAuthResultMessage,
  getOAuthProviderLabel,
} from '../utils/oauth';

type MessageState = {
  tone: 'success' | 'error' | 'info';
  text: string;
};

const PROVIDERS: OAuthProvider[] = ['GOOGLE', 'GITHUB'];

function createFallbackSocial(provider: OAuthProvider): SocialAccount {
  return {
    provider,
    connected: false,
    email: null,
    connectedAt: null,
  };
}

function formatConnectedAt(value: string | null) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getDisconnectErrorMessage(error: unknown, provider: OAuthProvider) {
  const code = getApiErrorCode(error);

  if (code === 'SOCIAL_ACCOUNT_NOT_LINKED') {
    return `연결된 ${getOAuthProviderLabel(provider)} 계정이 없습니다.`;
  }

  if (code === 'SOCIAL_ACCOUNT_DISCONNECT_NOT_ALLOWED') {
    return '마지막 로그인 수단이라 연결을 해제할 수 없습니다.';
  }

  if (axios.isAxiosError(error) && error.response?.status === 401) {
    return '로그인이 필요하거나 세션이 만료되었습니다.';
  }

  return `${getOAuthProviderLabel(provider)} 계정 연결 해제 중 문제가 발생했습니다.`;
}

function getSocialListErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403) {
      return '게스트 계정은 소셜 계정 정보를 조회할 수 없습니다.';
    }

    if (error.response?.status === 401) {
      return '로그인이 필요하거나 세션이 만료되었습니다.';
    }
  }

  return '소셜 계정 상태를 불러오지 못했습니다.';
}

function SocialAccountsPanel() {
  const [socials, setSocials] = useState<SocialAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [busyProvider, setBusyProvider] = useState<OAuthProvider | null>(null);

  const mergedSocials = useMemo(() => {
    const mapped = new Map(socials.map((item) => [item.provider, item]));
    return PROVIDERS.map((provider) => mapped.get(provider) ?? createFallbackSocial(provider));
  }, [socials]);

  useEffect(() => {
    const oauthResultMessage = consumeOAuthResultMessage();

    if (oauthResultMessage) {
      setMessage({
        tone: 'success',
        text: oauthResultMessage,
      });
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSocials = async () => {
      setIsLoading(true);

      try {
        const result = await getConnectedSocialAccounts();

        if (!isMounted) {
          return;
        }

        setSocials(result.socials);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setMessage({
          tone: 'error',
          text: getSocialListErrorMessage(error),
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadSocials();

    return () => {
      isMounted = false;
    };
  }, []);

  const beginSocialConnect = (provider: OAuthProvider) => {
    setMessage(null);

    const startUrl = buildOAuthStartUrl(provider, 'connect');

    if (!startUrl) {
      setMessage({
        tone: 'error',
        text: getOAuthConfigMissingMessage(provider),
      });
      return;
    }

    window.location.assign(startUrl);
  };

  const handleDisconnect = async (provider: OAuthProvider) => {
    setBusyProvider(provider);
    setMessage(null);

    try {
      if (provider === 'GOOGLE') {
        await disconnectGoogleSocialAccount();
      } else {
        await disconnectGithubSocialAccount();
      }

      setSocials((current) =>
        current.map((item) =>
          item.provider === provider
            ? {
                provider,
                connected: false,
                email: null,
                connectedAt: null,
              }
            : item,
        ),
      );
      setMessage({
        tone: 'success',
        text: `${getOAuthProviderLabel(provider)} 계정 연결이 해제되었습니다.`,
      });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: getDisconnectErrorMessage(error, provider),
      });
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <div className="space-y-5 border border-neutral-200 bg-white p-8">
      <div>
        <h2 className="text-xl font-black tracking-tight text-black">Social Accounts</h2>
        <p className="mt-2 text-sm text-neutral-600">
          로그인 수단으로 사용할 Google, GitHub 계정의 연결 상태를 확인하고 관리합니다.
        </p>
      </div>

      {message ? (
        <div
          className={`border px-4 py-3 text-sm ${
            message.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : message.tone === 'info'
                ? 'border-sky-200 bg-sky-50 text-sky-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          소셜 계정 상태를 불러오는 중입니다.
        </div>
      ) : (
        <div className="space-y-4">
          {mergedSocials.map((social) => {
            const providerLabel = getOAuthProviderLabel(social.provider);
            const isBusy = busyProvider === social.provider;

            return (
              <div
                className="flex flex-col gap-4 border border-neutral-200 px-4 py-4 md:flex-row md:items-center md:justify-between"
                key={social.provider}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-black">{providerLabel}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        social.connected
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {social.connected ? 'Connected' : 'Not connected'}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-700">
                    {social.email ?? `${providerLabel} 계정이 아직 연결되지 않았습니다.`}
                  </p>
                  <p className="text-xs text-neutral-500">
                    Connected at: {formatConnectedAt(social.connectedAt)}
                  </p>
                </div>

                {social.connected ? (
                  <button
                    className="inline-flex items-center justify-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isBusy}
                    onClick={() => void handleDisconnect(social.provider)}
                    type="button"
                  >
                    {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Unlink2 className="h-4 w-4" />}
                    연결 해제
                  </button>
                ) : (
                  <button
                    className="inline-flex items-center justify-center gap-2 bg-black px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                    onClick={() => beginSocialConnect(social.provider)}
                    type="button"
                  >
                    <Link2 className="h-4 w-4" />
                    계정 연결
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SocialAccountsPanel;
