import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';

import { getApiErrorMessage, getApiFieldErrors } from '../../../api/error';
import type { SignupFormValues } from '../../../types/auth';
import {
  checkEmailAvailability,
  registerUser,
  sendEmailVerificationCode,
} from '../api/member';
import {
  initialSignupFormValues,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from '../utils/signup';
import AuthButton from './AuthButton';
import AuthField from './AuthField';
import AuthMessage from './AuthMessage';
import AuthPanelHeading from './AuthPanelHeading';
import AuthSocialButton from './AuthSocialButton';

export type SignupStage = 'email' | 'verification' | 'profile' | 'complete';

type FieldErrors = Partial<Record<keyof SignupFormValues, string>>;

type SignupPanelProps = {
  stage: SignupStage;
  setStage: Dispatch<SetStateAction<SignupStage>>;
  onVerificationStarted: (email: string) => void;
};

function GithubLogo() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 24 24">
      <path
        d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.23-1.27-5.23-5.67 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18A10.99 10.99 0 0 1 12 6.07c.98 0 1.96.13 2.88.38 2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.35.78 1.05.78 2.12v3.15c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 24 24">
      <path
        d="M21.6 12.23c0-.77-.07-1.5-.2-2.2H12v4.16h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.31 2.98-7.49Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.24-2.51c-.9.6-2.05.95-3.38.95-2.6 0-4.81-1.76-5.6-4.13H3.06v2.59A9.99 9.99 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.4 13.88A6.02 6.02 0 0 1 6.08 12c0-.65.11-1.28.32-1.88V7.53H3.06A9.99 9.99 0 0 0 2 12c0 1.61.39 3.13 1.06 4.47l3.34-2.59Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.99c1.47 0 2.79.51 3.83 1.5l2.86-2.86C16.96 3.02 14.7 2 12 2a9.99 9.99 0 0 0-8.94 5.53l3.34 2.59C7.19 7.75 9.4 5.99 12 5.99Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function SignupPanel({ stage, setStage, onVerificationStarted }: SignupPanelProps) {
  const [values, setValues] = useState<SignupFormValues>(initialSignupFormValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{
    tone: 'error' | 'success';
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setFieldValue = <K extends keyof SignupFormValues>(field: K, value: SignupFormValues[K]) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setMessage(null);

    if (field === 'email') {
      setStage('email');
      setValues((current) => ({
        ...current,
        code: '',
        displayName: '',
        password: '',
        [field]: value,
      }));
    }
  };

  const setServerFieldErrors = (error: unknown) => {
    const nextFieldErrors = getApiFieldErrors(error);

    if (Object.keys(nextFieldErrors).length === 0) {
      return;
    }

    setFieldErrors((current) => ({
      ...current,
      ...nextFieldErrors,
    }));
  };

  const requestVerificationCode = async () => {
    const email = values.email.trim();
    const emailError = validateEmail(email);

    if (emailError) {
      setFieldErrors((current) => ({ ...current, email: emailError }));
      return;
    }

    const confirmed = window.confirm(
      `SSAFER.IO 내용:\n\n"${email}"\n해당 이메일로 코드를 전송하시겠습니까?`,
    );

    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const emailCheckResult = await checkEmailAvailability(email);

      if (!emailCheckResult.available) {
        window.alert('이미 가입된 이메일입니다.');
        return;
      }

      await sendEmailVerificationCode({ email });
      onVerificationStarted(email);
    } catch (error) {
      setServerFieldErrors(error);
      window.alert(getApiErrorMessage(error, '이메일 인증 코드 전송에 실패했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const registerVerifiedUser = async () => {
    const nextFieldErrors: FieldErrors = {
      displayName: validateDisplayName(values.displayName),
      password: validatePassword(values.password),
    };
    const hasError = Object.values(nextFieldErrors).some(Boolean);

    if (hasError) {
      setFieldErrors((current) => ({
        ...current,
        ...nextFieldErrors,
      }));
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      await registerUser({
        email: values.email.trim(),
        displayName: values.displayName.trim(),
        password: values.password,
      });
      setStage('complete');
      setMessage({ tone: 'success', text: '회원가입이 완료되었습니다.' });
    } catch (error) {
      setServerFieldErrors(error);
      setMessage({
        tone: 'error',
        text: getApiErrorMessage(error, '회원가입에 실패했습니다.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (stage === 'email' || stage === 'verification') {
      await requestVerificationCode();
      return;
    }

    if (stage === 'profile') {
      await registerVerifiedUser();
    }
  };

  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <div>
        <AuthPanelHeading subtitle="Member" title="New" />

        <div className="mt-[clamp(2.25rem,6.3vh,4rem)] space-y-[clamp(0.55rem,1.15vh,0.875rem)]">
          <AuthField
            autoComplete="email"
            errorMessage={fieldErrors.email}
            label="EMAIL ADDRESS"
            onChange={(event) => setFieldValue('email', event.target.value)}
            placeholder="Email Address"
            value={values.email}
          />

          {stage === 'profile' || stage === 'complete' ? (
            <>
              <AuthField
                autoComplete="nickname"
                errorMessage={fieldErrors.displayName}
                label="DISPLAY NAME"
                maxLength={100}
                onChange={(event) => setFieldValue('displayName', event.target.value)}
                placeholder="Display Name"
                value={values.displayName}
              />
              <AuthField
                autoComplete="new-password"
                errorMessage={fieldErrors.password}
                label="PASSWORD"
                maxLength={72}
                onChange={(event) => setFieldValue('password', event.target.value)}
                placeholder="Password"
                type="password"
                value={values.password}
              />
            </>
          ) : (
            <div className="grid grid-cols-3 auth-body-text text-white">
              <span>...</span>
              <span>...</span>
              <span>...</span>
            </div>
          )}

          <div className="flex gap-[7.5%] pt-0">
            <AuthSocialButton icon={<GithubLogo />} label="Github로 시작하기" />
            <AuthSocialButton icon={<GoogleLogo />} label="Google로 시작하기" />
          </div>
        </div>

        {message ? (
          <div className="mt-[clamp(0.875rem,1.6vh,1.5rem)]">
            <AuthMessage message={message.text} tone={message.tone} />
          </div>
        ) : null}

        <div className="mt-[clamp(3rem,6.5vh,4.75rem)] space-y-[clamp(0.875rem,2vh,1.25rem)]">
          <AuthButton isLoading={isSubmitting} type="submit">
            {stage === 'profile'
              ? 'Create Account'
              : stage === 'complete'
                ? 'Completed'
                : 'Continue'}
          </AuthButton>

          <div className="space-y-[clamp(0.5rem,0.84vh,1rem)] auth-body-text text-black">
            <p>By signing up, you agree to our Teams and Data policy</p>
            <p>가입함으로써 팀 및 데이터 정책에 동의합니다.</p>
          </div>
        </div>
      </div>
    </form>
  );
}

export default SignupPanel;
