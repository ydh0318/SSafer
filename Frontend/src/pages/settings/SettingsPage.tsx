import axios from 'axios';
import { AlertTriangle, BellRing, KeyRound, Lock, LogOut, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { getApiFieldErrors } from '../../api/error';
import ModalFrame from '../../components/common/ModalFrame';
import PageHero from '../../components/common/PageHero';
import PixelGoose from '../../components/common/PixelGoose';
import {
  changeCurrentUserPassword,
  checkNicknameAvailability,
  completePasswordReset,
  getCurrentUserProfile,
  logoutCurrentUser,
  sendPasswordResetCode,
  setupCurrentUserPassword,
  updateCurrentUserProfile,
  verifyPasswordResetCode,
  withdrawCurrentUser,
} from '../../features/auth/api/member';
import SocialAccountsPanel from '../../features/auth/components/SocialAccountsPanel';
import { useToast } from '../../features/feedback/useToast';
import { useAuthStore } from '../../store/authStore';
import type { AuthUser } from '../../types/auth';

type SettingsTab = 'profile' | 'security' | 'notify' | 'token' | 'danger';

type PasswordResetStep = 'idle' | 'code' | 'verified';

type MessageState = {
  tone: 'success' | 'error' | 'info';
  text: string;
};

type PasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type PasswordFieldErrors = Partial<Record<keyof PasswordFormValues, string>>;

const tabs: Array<{ id: SettingsTab; label: string; icon: typeof User }> = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'notify', label: 'Notifications', icon: BellRing },
  { id: 'token', label: 'Social', icon: KeyRound },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
];

const initialPasswordForm: PasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

function validateDisplayName(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return '닉네임을 입력해 주세요.';
  }

  if (normalized.length > 100) {
    return '닉네임은 100자 이하로 입력해 주세요.';
  }

  return '';
}

function validatePasswordForm(values: PasswordFormValues, isSetup: boolean): PasswordFieldErrors {
  const errors: PasswordFieldErrors = {};

  if (!isSetup) {
    if (!values.currentPassword) {
      errors.currentPassword = '현재 비밀번호를 입력해 주세요.';
    } else if (values.currentPassword.length < 8 || values.currentPassword.length > 72) {
      errors.currentPassword = '현재 비밀번호는 8자 이상 72자 이하로 입력해 주세요.';
    }
  }

  if (!values.newPassword) {
    errors.newPassword = '새 비밀번호를 입력해 주세요.';
  } else if (values.newPassword.length < 8 || values.newPassword.length > 72) {
    errors.newPassword = '새 비밀번호는 8자 이상 72자 이하로 입력해 주세요.';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = '새 비밀번호 확인 값을 입력해 주세요.';
  } else if (values.newPassword !== values.confirmPassword) {
    errors.confirmPassword = '새 비밀번호와 확인 값이 일치하지 않습니다.';
  }

  return errors;
}

function getProfileErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (status === 401) {
      return '로그인이 필요하거나 세션이 만료되었습니다.';
    }

    if (status === 403) {
      return '게스트 계정은 회원 프로필을 조회할 수 없습니다.';
    }

    if (status === 404) {
      return '회원 정보를 찾을 수 없습니다.';
    }
  }

  return '프로필을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

function getProfileUpdateErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const code = error.response?.data?.code;

    if (status === 409 || code === 'DUPLICATE_DISPLAY_NAME') {
      return '이미 사용 중인 닉네임입니다.';
    }

    if (status === 400) {
      return '닉네임 값이 올바르지 않습니다.';
    }

    if (status === 401) {
      return '로그인이 필요하거나 세션이 만료되었습니다.';
    }

    if (status === 403) {
      return '프로필을 수정할 수 없는 계정입니다.';
    }
  }

  return '프로필 저장 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}

function getNicknameCheckErrorMessage(error: unknown) {
  if (axios.isAxiosError(error) && error.response?.status === 400) {
    return '닉네임 형식을 다시 확인해 주세요.';
  }

  return '닉네임 중복 확인 중 문제가 발생했습니다.';
}

function isCurrentPasswordFailure(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const fieldErrors = getApiFieldErrors(error);
  const code = error.response?.data?.code;
  const message = String(error.response?.data?.message ?? '').toLowerCase();

  return (
    code === 'INVALID_CREDENTIALS' ||
    Boolean(fieldErrors.currentPassword) ||
    message.includes('current password') ||
    message.includes('password is incorrect') ||
    message.includes('password is invalid') ||
    message.includes('wrong password')
  );
}

function getPasswordChangeErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const code = error.response?.data?.code;

    if (code === 'INVALID_CREDENTIALS') {
      return '현재 비밀번호가 올바르지 않습니다.';
    }

    if (status === 400) {
      return '비밀번호 입력값을 다시 확인해 주세요.';
    }

    if (status === 401) {
      return '로그인이 필요하거나 세션이 만료되었습니다.';
    }

    if (status === 403) {
      return '비밀번호를 변경할 수 없는 계정입니다.';
    }

    if (status === 404) {
      return '회원 정보를 찾을 수 없습니다.';
    }
  }

  return '비밀번호 변경 중 문제가 발생했습니다.';
}

function getPasswordSetupErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const backendMessage = error.response?.data?.message;

    if (code === 'PASSWORD_SETUP_NOT_ALLOWED' || status === 409) {
      return '이미 이메일 비밀번호가 설정되어 있거나, 비밀번호 설정이 허용되지 않는 계정입니다. 페이지를 새로고침한 뒤 "비밀번호 변경" 화면에서 시도해 주세요.';
    }

    if (status === 400) {
      // DTO 검증을 통과한 상태에서의 INVALID_PARAMETER는 보통 형식 위반
      if (code === 'INVALID_PARAMETER') {
        return '비밀번호 형식이 올바르지 않습니다. 8자 이상 72자 이하의 영문/숫자/특수문자 조합으로 입력해 주세요.';
      }
      return '비밀번호는 8자 이상 72자 이하로 입력해 주세요.';
    }

    if (status === 401) {
      return '로그인 세션이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.';
    }

    if (status === 403) {
      return '회원 계정만 비밀번호를 설정할 수 있습니다. 게스트 계정에서는 사용할 수 없는 기능입니다.';
    }

    if (status && status >= 500) {
      return '서버에서 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    }

    if (!error.response) {
      return '네트워크 연결을 확인할 수 없습니다. 인터넷 연결 상태를 확인하고 다시 시도해 주세요.';
    }

    if (backendMessage) {
      return `비밀번호 설정 실패: ${backendMessage}`;
    }
  }

  return '비밀번호 설정 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}

function renderMessage(message: MessageState | null) {
  if (!message) {
    return null;
  }

  return (
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
  );
}

const VALID_TABS: SettingsTab[] = ['profile', 'security', 'notify', 'token', 'danger'];

function parseTabParam(raw: string | null): SettingsTab {
  if (raw && (VALID_TABS as string[]).includes(raw)) {
    return raw as SettingsTab;
  }
  return 'profile';
}

function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const setUser = useAuthStore((state) => state.setUser);
  const setTokens = useAuthStore((state) => state.setTokens);

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTabParam(searchParams.get('tab'));

  const setTab = (next: SettingsTab) => {
    setSearchParams(next === 'profile' ? {} : { tab: next }, { replace: true });
  };
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [initialDisplayName, setInitialDisplayName] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isCheckingDisplayName, setIsCheckingDisplayName] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<MessageState | null>(null);
  const [isDisplayNameConfirmed, setIsDisplayNameConfirmed] = useState(false);

  const [passwordValues, setPasswordValues] = useState<PasswordFormValues>(initialPasswordForm);
  const [passwordErrors, setPasswordErrors] = useState<PasswordFieldErrors>({});
  const [passwordMessage, setPasswordMessage] = useState<MessageState | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isCurrentPasswordRejected, setIsCurrentPasswordRejected] = useState(false);
  const [hasLocalPassword, setHasLocalPassword] = useState<boolean | null>(null);
  // 이번 세션에서 사용자가 직접 비밀번호 설정/변경을 완료했음을 표시한다.
  // 성공 직후 즉시 다른 폼으로 자동 전환되지 않도록 "완료 화면"을 유지하기 위함.
  const [sessionPasswordSet, setSessionPasswordSet] = useState(false);

  const [resetStep, setResetStep] = useState<PasswordResetStep>('idle');
  const [resetCode, setResetCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [isSendingResetCode, setIsSendingResetCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isCompletingReset, setIsCompletingReset] = useState(false);

  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const toast = useToast();

  const isGuestUser = user?.role === 'GUEST';
  const isProfileDirty = useMemo(
    () => displayName.trim() !== initialDisplayName.trim(),
    [displayName, initialDisplayName],
  );
  const isSetupMode = hasLocalPassword !== true;
  const isCurrentPasswordReady =
    passwordValues.currentPassword.trim().length > 0 && !isCurrentPasswordRejected;
  const areNewPasswordFieldsLocked = !isSetupMode && !isCurrentPasswordReady;
  const isConfirmPasswordMatched =
    passwordValues.newPassword.length > 0 &&
    passwordValues.confirmPassword.length > 0 &&
    passwordValues.newPassword === passwordValues.confirmPassword &&
    !passwordErrors.confirmPassword;

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (isGuestUser) {
        setIsLoadingProfile(false);
        setProfileError('게스트 계정은 회원 프로필을 조회할 수 없습니다.');
        return;
      }

      setIsLoadingProfile(true);
      setProfileError(null);
      setProfileMessage(null);

      try {
        const profile = await getCurrentUserProfile();

        if (!isMounted) {
          return;
        }

        setEmail(profile.email);
        setDisplayName(profile.displayName);
        setInitialDisplayName(profile.displayName);
        setIsDisplayNameConfirmed(true);
        setHasLocalPassword(profile.hasLocalPassword ?? null);
        setUser({
          id: user?.id ?? profile.email,
          email: profile.email,
          name: profile.displayName,
          role: user?.role,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setProfileError(getProfileErrorMessage(error));
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [isGuestUser, setUser, user?.email, user?.id, user?.role]);

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    setDisplayNameError(null);
    setProfileMessage(null);
    setIsDisplayNameConfirmed(value.trim() === initialDisplayName.trim());
  };

  const handleDisplayNameCheck = async () => {
    const validationMessage = validateDisplayName(displayName);

    if (validationMessage) {
      setDisplayNameError(validationMessage);
      setProfileMessage(null);
      setIsDisplayNameConfirmed(false);
      return;
    }

    if (!isProfileDirty) {
      setDisplayNameError(null);
      setIsDisplayNameConfirmed(true);
      setProfileMessage({
        tone: 'success',
        text: '현재 닉네임을 그대로 사용 중입니다.',
      });
      return;
    }

    setIsCheckingDisplayName(true);
    setDisplayNameError(null);
    setProfileMessage({
      tone: 'info',
      text: '닉네임 중복 여부를 확인하고 있습니다.',
    });

    try {
      const result = await checkNicknameAvailability(displayName.trim());

      if (result.available) {
        setIsDisplayNameConfirmed(true);
        setProfileMessage({
          tone: 'success',
          text: '사용 가능한 닉네임입니다.',
        });
        return;
      }

      setIsDisplayNameConfirmed(false);
      setDisplayNameError('이미 사용 중인 닉네임입니다.');
      setProfileMessage(null);
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error);
      setIsDisplayNameConfirmed(false);
      setDisplayNameError(fieldErrors.nickname ?? null);
      setProfileMessage({
        tone: 'error',
        text: getNicknameCheckErrorMessage(error),
      });
    } finally {
      setIsCheckingDisplayName(false);
    }
  };

  const handleSaveProfile = async () => {
    const nextDisplayName = displayName.trim();
    const validationMessage = validateDisplayName(nextDisplayName);

    if (validationMessage) {
      setDisplayNameError(validationMessage);
      setProfileMessage(null);
      return;
    }

    if (!isProfileDirty) {
      setProfileMessage({
        tone: 'success',
        text: '변경된 내용이 없습니다.',
      });
      return;
    }

    if (!isDisplayNameConfirmed) {
      setDisplayNameError('닉네임 중복 확인을 먼저 진행해 주세요.');
      setProfileMessage(null);
      return;
    }

    setIsSavingProfile(true);
    setDisplayNameError(null);
    setProfileMessage(null);

    try {
      const profile = await updateCurrentUserProfile({
        displayName: nextDisplayName,
      });

      const nextUser: AuthUser = {
        id: user?.id ?? profile.email,
        email: profile.email,
        name: profile.displayName,
        role: user?.role,
      };

      setEmail(profile.email);
      setDisplayName(profile.displayName);
      setInitialDisplayName(profile.displayName);
      setIsDisplayNameConfirmed(true);
      setUser(nextUser);
      setProfileMessage({
        tone: 'success',
        text: '프로필이 저장되었습니다.',
      });
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error);
      setDisplayNameError(fieldErrors.displayName ?? null);
      setProfileMessage({
        tone: 'error',
        text: getProfileUpdateErrorMessage(error),
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCurrentPasswordChange = (value: string) => {
    setPasswordValues((current) => ({
      ...current,
      currentPassword: value,
      ...(isCurrentPasswordRejected ? { newPassword: '', confirmPassword: '' } : {}),
    }));
    setPasswordErrors((current) => ({
      ...current,
      currentPassword: undefined,
      ...(isCurrentPasswordRejected ? { newPassword: undefined, confirmPassword: undefined } : {}),
    }));
    setPasswordMessage(null);
    setIsCurrentPasswordRejected(false);
  };

  const handleNewPasswordChange = (value: string) => {
    setPasswordValues((current) => ({ ...current, newPassword: value }));
    setPasswordErrors((current) => ({
      ...current,
      newPassword: undefined,
      confirmPassword: undefined,
    }));
    setPasswordMessage(null);
  };

  const handleConfirmPasswordChange = (value: string) => {
    setPasswordValues((current) => ({ ...current, confirmPassword: value }));
    setPasswordErrors((current) => ({
      ...current,
      confirmPassword: undefined,
    }));
    setPasswordMessage(null);
  };

  const handlePasswordChange = async () => {
    const nextErrors = validatePasswordForm(passwordValues, isSetupMode);

    if (areNewPasswordFieldsLocked) {
      nextErrors.currentPassword =
        passwordValues.currentPassword.trim().length === 0
          ? '현재 비밀번호를 먼저 입력해 주세요.'
          : '현재 비밀번호를 다시 확인해 주세요.';
    }

    setPasswordErrors(nextErrors);
    setPasswordMessage(null);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setIsChangingPassword(true);

    try {
      let tokenData;
      if (isSetupMode) {
        tokenData = await setupCurrentUserPassword({ newPassword: passwordValues.newPassword });
      } else {
        tokenData = await changeCurrentUserPassword({
          currentPassword: passwordValues.currentPassword,
          newPassword: passwordValues.newPassword,
        });
      }

      // 토큰이 누락된 경우 상태 불일치를 방지하기 위해 에러로 처리합니다.
      // UI를 "설정 완료"로 전환하기 전에 반드시 세션 갱신이 성공해야 합니다.
      if (!tokenData.accessToken) {
        throw new Error('Token missing in response');
      }

      // 토큰 저장이 완전히 완료된 후에만 UI 상태를 전환합니다.
      setTokens({
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
      });

      setPasswordValues(initialPasswordForm);
      setPasswordErrors({});
      setPasswordMessage(null);
      setIsCurrentPasswordRejected(false);
      setHasLocalPassword(true);
      setSessionPasswordSet(true);
      toast.success(
        isSetupMode
          ? '비밀번호가 설정되었습니다. 이제 이메일/비밀번호 로그인도 사용할 수 있습니다.'
          : '비밀번호가 변경되었습니다.',
      );
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error);

      if (isCurrentPasswordFailure(error)) {
        setIsCurrentPasswordRejected(true);
        setPasswordValues((current) => ({
          ...current,
          newPassword: '',
          confirmPassword: '',
        }));
        setPasswordErrors({
          currentPassword: fieldErrors.currentPassword ?? '현재 비밀번호가 올바르지 않습니다.',
        });
        setPasswordMessage({
          tone: 'error',
          text: '현재 비밀번호를 다시 확인한 뒤 새 비밀번호를 입력해 주세요.',
        });
      } else {
        setPasswordErrors((current) => ({
          ...current,
          currentPassword: fieldErrors.currentPassword ?? current.currentPassword,
          newPassword: fieldErrors.newPassword ?? current.newPassword,
          confirmPassword: fieldErrors.confirmPassword ?? current.confirmPassword,
        }));
        setPasswordMessage({
          tone: 'error',
          text: isSetupMode ? getPasswordSetupErrorMessage(error) : getPasswordChangeErrorMessage(error),
        });
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleInitiateReset = async () => {
    if (!email) {
      toast.error('이메일 정보를 불러올 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
      return;
    }

    setIsSendingResetCode(true);
    // 재발송하는 경우 이전 토큰/코드를 비워둔다
    setResetToken('');
    setResetCode('');

    try {
      await sendPasswordResetCode({ email });
      setResetStep('code');
      toast.info(`${email}로 인증 코드를 발송했습니다. 받은편지함(스팸함 포함)을 확인해 주세요.`, {
        durationMs: 5000,
      });
    } catch (error) {
      console.error('[sendPasswordResetCode] failed:', error);

      let message = '인증 코드 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.';

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const code = error.response?.data?.code;
        const backendMessage = error.response?.data?.message;

        console.error('[sendPasswordResetCode] status:', status, 'code:', code, 'message:', backendMessage);

        if (status === 429 || code === 'TOO_MANY_REQUESTS') {
          message = '인증 코드 발송 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
        } else if (status === 404) {
          message = '해당 이메일로 등록된 계정을 찾을 수 없습니다.';
        } else if (status === 400) {
          message = '이메일 형식이 올바르지 않습니다.';
        } else if (status && status >= 500) {
          message = '메일 서버에서 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
        } else if (!error.response) {
          message = '네트워크 연결을 확인할 수 없습니다. 인터넷 연결 상태를 확인하고 다시 시도해 주세요.';
        } else if (backendMessage) {
          message = `발송 실패: ${backendMessage}`;
        }
      }

      toast.error(message);
    } finally {
      setIsSendingResetCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!resetCode.trim()) {
      toast.error('메일로 받은 인증 코드를 입력해 주세요.');
      return;
    }

    setIsVerifyingCode(true);
    try {
      const { resetToken: token } = await verifyPasswordResetCode({ email, code: resetCode.trim() });
      setResetToken(token);
      setResetStep('verified');
      toast.success('인증이 완료되었습니다. 새 비밀번호를 입력해 주세요.');
    } catch (error) {
      console.error('[verifyPasswordResetCode] failed:', error);

      let message = '인증에 실패했습니다. 잠시 후 다시 시도해 주세요.';

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const code = error.response?.data?.code;
        const backendMessage = error.response?.data?.message;

        console.error('[verifyPasswordResetCode] status:', status, 'code:', code, 'message:', backendMessage);

        if (code === 'PASSWORD_RESET_CODE_INVALID' || code === 'INVALID_VERIFICATION_CODE') {
          message = '인증 코드가 일치하지 않습니다. 메일을 다시 확인해 주세요.';
        } else if (code === 'PASSWORD_RESET_CODE_EXPIRED' || code === 'EXPIRED_VERIFICATION_CODE') {
          message = '인증 코드가 만료되었습니다. "인증 코드 재발송"을 눌러 새 코드를 받아주세요.';
        } else if (status === 429) {
          message = '인증 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
        } else if (status === 404) {
          message = '발송된 인증 코드를 찾을 수 없습니다. 먼저 "인증 코드 재발송"을 눌러주세요.';
        } else if (status === 400) {
          message = '인증 코드 형식이 올바르지 않습니다. 메일에 적힌 숫자 코드를 그대로 입력해 주세요.';
        } else if (status && status >= 500) {
          message = '서버에서 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
        } else if (!error.response) {
          message = '네트워크 연결을 확인할 수 없습니다. 인터넷 연결 상태를 확인하고 다시 시도해 주세요.';
        } else if (backendMessage) {
          message = `인증 실패: ${backendMessage}`;
        }
      }

      toast.error(message);
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleCompleteReset = async () => {
    if (!resetToken) {
      toast.error('인증을 먼저 완료해 주세요.');
      return;
    }
    if (!resetNewPassword || resetNewPassword.length < 8 || resetNewPassword.length > 72) {
      toast.error('새 비밀번호는 8자 이상 72자 이하로 입력해 주세요.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      toast.error('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsCompletingReset(true);
    try {
      await completePasswordReset({ resetToken, newPassword: resetNewPassword });
      // 성공 시 폼/토큰을 모두 비우고 idle 상태로 돌려놓는다.
      setResetStep('idle');
      setResetCode('');
      setResetToken('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      setPasswordValues(initialPasswordForm);
      setPasswordErrors({});
      setPasswordMessage(null);
      setHasLocalPassword(true);
      setSessionPasswordSet(true);
      toast.success('비밀번호가 성공적으로 재설정되었습니다.');
    } catch (error) {
      console.error('[completePasswordReset] failed:', error);

      let message = '비밀번호 재설정에 실패했습니다. 잠시 후 다시 시도해 주세요.';
      let shouldResetToCode = false;
      let shouldClearPasswords = false;

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const code = error.response?.data?.code;
        const backendMessage = error.response?.data?.message;
        const fieldErrors = getApiFieldErrors(error);

        console.error('[completePasswordReset] status:', status, 'code:', code, 'message:', backendMessage, 'fieldErrors:', fieldErrors);

        // 토큰 만료/무효 — 코드 발송 단계로 되돌아가야 함
        if (
          code === 'PASSWORD_RESET_TOKEN_INVALID' ||
          code === 'INVALID_RESET_TOKEN' ||
          code === 'EXPIRED_RESET_TOKEN' ||
          status === 401
        ) {
          message =
            '인증 세션이 만료되었거나 이미 사용된 인증 코드입니다. "인증 코드 재발송"을 눌러 새 코드를 받아주세요.';
          shouldResetToCode = true;
          shouldClearPasswords = true;
        }
        // 백엔드가 별도 코드를 내려주면 정확히 매칭
        else if (code === 'PASSWORD_SAME_AS_OLD' || code === 'SAME_PASSWORD') {
          message =
            '새 비밀번호가 기존 비밀번호와 동일합니다. 이전에 사용한 적 없는 다른 비밀번호로 입력해 주세요.';
          shouldClearPasswords = true;
        }
        // OAuth 전용 계정이라 재설정 불가
        else if (code === 'PASSWORD_RESET_NOT_ALLOWED' || status === 409) {
          message =
            '소셜 로그인 전용 계정이라 비밀번호 재설정을 사용할 수 없습니다. 이전 화면에서 NEW PASSWORD를 직접 등록해 주세요.';
        }
        // 계정을 찾을 수 없음
        else if (status === 404) {
          message =
            '해당 이메일로 등록된 계정의 비밀번호 정보를 찾을 수 없습니다. 관리자에게 문의해 주세요.';
        }
        // 400 INVALID_PARAMETER — 가장 흔한 케이스
        else if (status === 400) {
          // 필드 에러가 명확히 내려온 경우 그 메시지를 우선 사용
          if (fieldErrors.newPassword) {
            message = fieldErrors.newPassword;
          }
          // 그렇지 않으면 백엔드가 같은 비밀번호를 INVALID_PARAMETER로 던지는 케이스가 가장 유력
          // (DTO 검증은 이미 통과했으므로 길이/형식 문제가 아님)
          else if (code === 'INVALID_PARAMETER') {
            message =
              '새 비밀번호가 기존 비밀번호와 동일하거나 사용할 수 없는 형식입니다. ' +
              '이전에 사용한 적 없는 새로운 비밀번호로 입력해 주세요. (영문/숫자/특수문자 조합 권장)';
            shouldClearPasswords = true;
          } else if (backendMessage) {
            message = `비밀번호 재설정 실패: ${backendMessage}`;
          } else {
            message = '입력값을 다시 확인해 주세요.';
          }
        }
        // 500 등 서버 오류
        else if (status && status >= 500) {
          message =
            '서버에서 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. 문제가 반복되면 관리자에게 문의해 주세요.';
        }
        // 네트워크 오류 (응답 자체가 없는 경우)
        else if (!error.response) {
          message =
            '네트워크 연결을 확인할 수 없습니다. 인터넷 연결 상태를 확인하고 다시 시도해 주세요.';
        }
        // 그 외 백엔드 메시지가 있으면 그대로 노출
        else if (backendMessage) {
          message = `비밀번호 재설정 실패: ${backendMessage}`;
        }
      }

      toast.error(message, { durationMs: 5000 });
      if (shouldClearPasswords) {
        setResetNewPassword('');
        setResetConfirmPassword('');
      }
      if (shouldResetToCode) {
        setResetToken('');
        setResetCode('');
        setResetStep('code');
      }
    } finally {
      setIsCompletingReset(false);
    }
  };

  const handleCancelReset = () => {
    setResetStep('idle');
    setResetCode('');
    setResetToken('');
    setResetNewPassword('');
    setResetConfirmPassword('');
  };

  const handleLogout = async () => {
    try {
      await logoutCurrentUser();
    } catch {
      // Ignore logout API failures and clear local session.
    } finally {
      logout();
    }
  };

  const handleWithdraw = async () => {
    setIsWithdrawModalOpen(false);
    try {
      await withdrawCurrentUser();
      toast.success('회원 탈퇴 처리가 완료되었습니다.');
      logout();
    } catch {
      toast.error('회원 탈퇴 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  };

  return (
    <section className="space-y-8">
      <PageHero description={null} eyebrow="SETTINGS" title="설정" />

      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border border-neutral-200 bg-white">
          {tabs.map((item) => {
            const Icon = item.icon;

            return (
              <button
                className={`flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left last:border-b-0 ${
                  tab === item.id ? 'border-l-2 border-l-black bg-[#F5F5F5] font-bold' : 'hover:bg-[#F5F5F5]'
                }`}
                key={item.id}
                onClick={() => setTab(item.id)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </aside>

        <main>
          {tab === 'profile' ? (
            <div className="theme-settings-panel space-y-5 border border-neutral-200 bg-white p-8">
              {isLoadingProfile ? (
                <div className="text-sm text-neutral-600">프로필을 불러오는 중입니다.</div>
              ) : profileError ? (
                <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{profileError}</div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold tracking-[0.24em] text-neutral-500">EMAIL</span>
                      <input
                        className="theme-settings-input mt-1 block w-full border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm"
                        disabled
                        value={email}
                      />
                    </label>

                    <div className="block">
                      <span className="text-xs font-bold tracking-[0.24em] text-neutral-500">DISPLAY NAME</span>
                      <div className="mt-1 flex items-stretch">
                        <input
                          className={`theme-settings-input block w-full border px-3 py-2 text-sm ${
                            displayNameError ? 'border-rose-500' : 'border-neutral-300'
                          }`}
                          maxLength={100}
                          onChange={(event) => handleDisplayNameChange(event.target.value)}
                          value={displayName}
                        />
                        <button
                          className="w-[8.5rem] shrink-0 border border-black bg-black px-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isCheckingDisplayName}
                          onClick={() => void handleDisplayNameCheck()}
                          type="button"
                        >
                          {isCheckingDisplayName ? 'Checking...' : 'Check'}
                        </button>
                      </div>
                      {displayNameError ? <p className="mt-2 text-sm text-rose-600">{displayNameError}</p> : null}
                    </div>
                  </div>

                  {renderMessage(profileMessage)}

                  <button
                    className="bg-black px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSavingProfile || isCheckingDisplayName}
                    onClick={() => void handleSaveProfile()}
                    type="button"
                  >
                    {isSavingProfile ? 'Saving...' : 'Save'}
                  </button>
                </>
              )}
            </div>
          ) : null}

          {tab === 'security' ? (
            <div className="theme-settings-panel space-y-5 border border-neutral-200 bg-white p-8">
              {isLoadingProfile || hasLocalPassword === null ? (
                <div className="text-sm text-neutral-400">비밀번호 설정 정보를 불러오는 중입니다.</div>
              ) : (
              <>
              {/* Account Status Header: 백엔드의 hasLocalPassword 값을 신뢰하여 표시 */}
              {hasLocalPassword === true ? (
                <div className="mb-2 flex items-center justify-between border border-emerald-200 bg-emerald-50 px-5 py-4">
                  <div className="text-sm font-bold text-emerald-600">이메일 로그인 비밀번호: 설정 완료</div>
                  <div className="hidden text-xs text-neutral-500 sm:block">
                    CLI에서 이메일/비밀번호 로그인을 사용할 수 있습니다.
                  </div>
                </div>
              ) : (
                <div className="mb-2 flex items-center justify-between border border-rose-200 bg-rose-50 px-5 py-4">
                  <div className="text-sm font-bold text-[#E63946]">이메일 로그인 비밀번호: 설정 미완료</div>
                  <div className="hidden text-xs text-neutral-500 sm:block">
                    비밀번호를 설정하면 CLI에서 이메일/비밀번호로 로그인할 수 있습니다.
                  </div>
                </div>
              )}

              {/* Form */}
              {sessionPasswordSet ? (
                /* 이번 세션에서 비밀번호 설정/변경/재설정을 완료한 직후 — 성공 화면을 유지하고 자동 폼 전환을 막는다. */
                <div className="space-y-4">
                  <div className="border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
                    ✓ 비밀번호가 정상적으로 설정되었습니다. 이제 이메일/비밀번호로 로그인할 수 있어요.
                  </div>
                  <button
                    className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
                    onClick={() => {
                      setSessionPasswordSet(false);
                      setResetStep('idle');
                      setResetCode('');
                      setResetToken('');
                      setResetNewPassword('');
                      setResetConfirmPassword('');
                      setPasswordValues(initialPasswordForm);
                      setPasswordErrors({});
                      setPasswordMessage(null);
                      // 이전 시도에서 잘못된 현재 비밀번호로 인해 잠긴 상태가 남지 않도록 함께 초기화한다.
                      setIsCurrentPasswordRejected(false);
                    }}
                    type="button"
                  >
                    비밀번호 다시 변경하기
                  </button>
                </div>
              ) : hasLocalPassword === true ? (
                  /* hasLocalPassword: true (이메일 가입자 또는 비밀번호 설정 완료한 OAuth 가입자)
                   * → 기본은 CURRENT PASSWORD 입력 폼.
                   * → 현재 비밀번호를 모르는 사용자는 "비밀번호를 잊으셨나요?" 링크로 이메일 코드 흐름 진입.
                   */
                  resetStep === 'idle' ? (
                    <div className="space-y-4">
                      <label className="block">
                        <span className="text-xs font-bold tracking-[0.24em] text-neutral-500">CURRENT PASSWORD</span>
                        <input
                          className={`theme-settings-input mt-1 block w-full border px-3 py-2 text-sm ${
                            passwordErrors.currentPassword ? 'border-rose-500' : 'border-neutral-300'
                          }`}
                          onChange={(event) => handleCurrentPasswordChange(event.target.value)}
                          type="password"
                          value={passwordValues.currentPassword}
                        />
                        {passwordErrors.currentPassword ? (
                          <p className="mt-2 text-sm text-rose-600">{passwordErrors.currentPassword}</p>
                        ) : (
                          <p className="mt-2 text-sm text-neutral-500">
                            현재 비밀번호를 입력하면 새 비밀번호 입력 칸이 열립니다.
                          </p>
                        )}
                        <button
                          className="mt-2 text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-600 disabled:cursor-not-allowed"
                          disabled={isSendingResetCode || !email}
                          onClick={() => void handleInitiateReset()}
                          type="button"
                        >
                          {isSendingResetCode ? '코드 발송 중...' : '비밀번호를 잊으셨나요?'}
                        </button>
                      </label>

                      <label className="block">
                        <span className="text-xs font-bold tracking-[0.24em] text-neutral-500">NEW PASSWORD</span>
                        <input
                          className={`theme-settings-input mt-1 block w-full border px-3 py-2 text-sm ${
                            passwordErrors.newPassword ? 'border-rose-500' : 'border-neutral-300'
                          } ${areNewPasswordFieldsLocked ? 'bg-neutral-50 text-neutral-400' : ''}`}
                          disabled={areNewPasswordFieldsLocked}
                          onChange={(event) => handleNewPasswordChange(event.target.value)}
                          type="password"
                          value={passwordValues.newPassword}
                        />
                        {passwordErrors.newPassword ? (
                          <p className="mt-2 text-sm text-rose-600">{passwordErrors.newPassword}</p>
                        ) : null}
                      </label>

                      <label className="block">
                        <span className="text-xs font-bold tracking-[0.24em] text-neutral-500">CONFIRM PASSWORD</span>
                        <input
                          className={`theme-settings-input mt-1 block w-full border px-3 py-2 text-sm ${
                            passwordErrors.confirmPassword
                              ? 'border-rose-500'
                              : isConfirmPasswordMatched
                                ? 'border-emerald-500'
                                : 'border-neutral-300'
                          } ${areNewPasswordFieldsLocked ? 'bg-neutral-50 text-neutral-400' : ''}`}
                          disabled={areNewPasswordFieldsLocked}
                          onChange={(event) => handleConfirmPasswordChange(event.target.value)}
                          type="password"
                          value={passwordValues.confirmPassword}
                        />
                        {passwordErrors.confirmPassword ? (
                          <p className="mt-2 text-sm text-rose-600">{passwordErrors.confirmPassword}</p>
                        ) : isConfirmPasswordMatched ? (
                          <p className="mt-2 text-sm text-emerald-600">새 비밀번호가 일치합니다.</p>
                        ) : null}
                      </label>

                      {renderMessage(passwordMessage)}

                      <button
                        className="bg-black px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isChangingPassword}
                        onClick={() => void handlePasswordChange()}
                        type="button"
                      >
                        {isChangingPassword ? 'Updating...' : 'Change Password'}
                      </button>
                    </div>
                  ) : resetStep === 'code' ? (
                    /* Step 2: 인증 코드 입력 + 검증 */
                    <div className="space-y-4">
                      <div className="border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                        <span className="font-medium text-neutral-900">{email}</span>로 인증 코드를 발송했습니다. 메일함을 확인하고 코드를 입력해 주세요.
                      </div>

                      <label className="block">
                        <span className="text-xs font-bold tracking-[0.24em] text-neutral-500">인증 코드</span>
                        <div className="mt-1 flex items-stretch gap-2">
                          <input
                            className="theme-settings-input block w-full border border-neutral-300 px-3 py-2 text-sm"
                            onChange={(e) => setResetCode(e.target.value)}
                            placeholder="6자리 코드 입력"
                            type="text"
                            value={resetCode}
                          />
                          <button
                            className="w-32 shrink-0 border border-black bg-black px-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isVerifyingCode || !resetCode.trim()}
                            onClick={() => void handleVerifyCode()}
                            type="button"
                          >
                            {isVerifyingCode ? 'Verifying...' : '코드 확인'}
                          </button>
                        </div>
                      </label>

                      <div className="flex items-center gap-3">
                        <button
                          className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isSendingResetCode}
                          onClick={() => void handleInitiateReset()}
                          type="button"
                        >
                          {isSendingResetCode ? '재발송 중...' : '인증 코드 재발송'}
                        </button>
                        <button
                          className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
                          onClick={handleCancelReset}
                          type="button"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Step 3: 새 비밀번호 입력 (인증 완료 후) */
                    <div className="space-y-4">
                      <p className="text-sm text-neutral-500">
                        새 비밀번호를 입력해 주세요. 8자 이상 72자 이하, 이전에 사용한 적 없는 값으로 입력해 주세요.
                      </p>

                      <label className="block">
                        <span className="text-xs font-bold tracking-[0.24em] text-neutral-500">NEW PASSWORD</span>
                        <input
                          className="theme-settings-input mt-1 block w-full border border-neutral-300 px-3 py-2 text-sm"
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          placeholder="8자 이상 72자 이하"
                          type="password"
                          value={resetNewPassword}
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-bold tracking-[0.24em] text-neutral-500">CONFIRM PASSWORD</span>
                        <input
                          className={`theme-settings-input mt-1 block w-full border px-3 py-2 text-sm ${
                            resetConfirmPassword && resetNewPassword === resetConfirmPassword
                              ? 'border-emerald-500'
                              : 'border-neutral-300'
                          }`}
                          onChange={(e) => setResetConfirmPassword(e.target.value)}
                          type="password"
                          value={resetConfirmPassword}
                        />
                        {resetConfirmPassword && resetNewPassword === resetConfirmPassword ? (
                          <p className="mt-2 text-sm text-emerald-600">새 비밀번호가 일치합니다.</p>
                        ) : null}
                      </label>

                      <div className="flex items-center gap-3">
                        <button
                          className="bg-black px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isCompletingReset}
                          onClick={() => void handleCompleteReset()}
                          type="button"
                        >
                          {isCompletingReset ? 'Resetting...' : '비밀번호 재설정'}
                        </button>
                        <button
                          className="border border-neutral-300 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isCompletingReset}
                          onClick={handleCancelReset}
                          type="button"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  /* hasLocalPassword: false / undefined → 직접 새 비밀번호 설정 (CURRENT PASSWORD 없음) */
                  <div className="grid gap-4">
                    <label className="block">
                      <span className="text-xs font-bold tracking-[0.24em] text-neutral-500">NEW PASSWORD</span>
                      <input
                        className={`theme-settings-input mt-1 block w-full border px-3 py-2 text-sm ${
                          passwordErrors.newPassword ? 'border-rose-500' : 'border-neutral-300'
                        }`}
                        onChange={(event) => handleNewPasswordChange(event.target.value)}
                        type="password"
                        value={passwordValues.newPassword}
                      />
                      {passwordErrors.newPassword ? (
                        <p className="mt-2 text-sm text-rose-600">{passwordErrors.newPassword}</p>
                      ) : null}
                    </label>

                    <label className="block">
                      <span className="text-xs font-bold tracking-[0.24em] text-neutral-500">CONFIRM PASSWORD</span>
                      <input
                        className={`theme-settings-input mt-1 block w-full border px-3 py-2 text-sm ${
                          passwordErrors.confirmPassword
                            ? 'border-rose-500'
                            : isConfirmPasswordMatched
                              ? 'border-emerald-500'
                              : 'border-neutral-300'
                        }`}
                        onChange={(event) => handleConfirmPasswordChange(event.target.value)}
                        type="password"
                        value={passwordValues.confirmPassword}
                      />
                      {passwordErrors.confirmPassword ? (
                        <p className="mt-2 text-sm text-rose-600">{passwordErrors.confirmPassword}</p>
                      ) : isConfirmPasswordMatched ? (
                        <p className="mt-2 text-sm text-emerald-600">새 비밀번호가 일치합니다.</p>
                      ) : null}
                    </label>

                    {renderMessage(passwordMessage)}

                    <button
                      className="bg-black px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isChangingPassword}
                      onClick={() => void handlePasswordChange()}
                      type="button"
                    >
                      {isChangingPassword ? 'Setting...' : 'Set Password'}
                    </button>
                  </div>
                )}
              </>
              )}
            </div>
          ) : null}

          {tab === 'notify' ? (
            <div className="border border-neutral-200 bg-white p-8 text-sm text-neutral-600">
              알림 설정 영역은 아직 연결 전입니다.
            </div>
          ) : null}

          {tab === 'token' ? <SocialAccountsPanel /> : null}

        {tab === 'danger' ? (
            <div className="space-y-4 border-2 border-[#E63946] bg-white p-8">
              <h2 className="text-xl font-black tracking-tight text-[#E63946]">Danger Zone</h2>
              <div className="flex flex-col gap-4 border-t border-neutral-200 pt-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                  <div>
                    <div className="font-bold">로그아웃</div>
                    <div className="mt-1 text-xs text-neutral-500">현재 로그인 세션을 종료합니다.</div>
                  </div>
                  <button
                    className="inline-flex items-center gap-1.5 border border-neutral-300 px-4 py-2 text-sm"
                    onClick={() => void handleLogout()}
                    type="button"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    로그아웃
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="font-bold text-[#E63946]">회원 탈퇴</div>
                    <div className="mt-1 text-xs text-neutral-500">계정과 관련된 모든 데이터가 삭제되며, 복구할 수 없습니다.</div>
                  </div>
                  <button
                    className="inline-flex items-center gap-1.5 bg-[#E63946] px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
                    onClick={() => setIsWithdrawModalOpen(true)}
                    type="button"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    탈퇴하기
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>

      {isWithdrawModalOpen ? (
        <ModalFrame onClose={() => setIsWithdrawModalOpen(false)}>
          <div className="rounded-2xl border border-white/50 bg-white/85 p-8 shadow-2xl backdrop-blur-lg">
            <h3 className="text-xl font-black text-[#E63946]">정말로 탈퇴하시겠습니까?</h3>
            <p className="mt-4 text-sm text-neutral-600">
              이 작업은 취소할 수 없으며, 프로젝트, 스캔 기록 등 계정과 관련된 <strong>모든 데이터가 영구적으로 삭제</strong>됩니다.
            </p>
            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                className="rounded bg-neutral-200 px-5 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-300"
                onClick={() => setIsWithdrawModalOpen(false)}
                type="button"
              >
                취소
              </button>
              <div className="group relative">
                <div className="pointer-events-none absolute -top-20 left-1/2 flex -translate-x-1/2 translate-y-4 flex-col items-center opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="mb-1 animate-bounce whitespace-nowrap rounded-lg bg-white px-2 py-1 text-[10px] font-black text-black shadow-lg">
                    또 보자!
                  </div>
                  <PixelGoose mood="victory" size={48} />
                </div>
                <button
                  className="relative z-10 rounded bg-[#E63946] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-600"
                  onClick={() => void handleWithdraw()}
                  type="button"
                >
                  탈퇴 진행
                </button>
              </div>
            </div>
          </div>
        </ModalFrame>
      ) : null}
    </section>
  );
}

export default SettingsPage;
