import { useState } from 'react';

import { getApiFieldErrors } from '../../../api/error';
import type { SignupFormValues } from '../../../types/auth';
import { checkEmailAvailability, sendEmailVerificationCode } from '../api/member';
import { getTooManyRequestsMessage } from '../utils/authError';
import { validateEmail } from '../utils/signup';
import AuthButton from './AuthButton';
import AuthField from './AuthField';
import AuthPanelHeading from './AuthPanelHeading';
import AuthSocialButton from './AuthSocialButton';

type SignupEmailPanelProps = {
  email: string;
  onEmailChange: (email: string) => void;
  onVerificationStarted: (email: string) => void;
  onVerificationCodeSent: (email: string) => void;
};

type FieldErrors = Partial<Record<keyof SignupFormValues, string>>;

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-8 w-8"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12S17.4 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
        fill="#FFC107"
      />
      <path
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z"
        fill="#FF3D00"
      />
      <path
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3c-2.1 1.6-4.7 2.5-7.3 2.5-5.3 0-9.7-3.3-11.4-8l-6.5 5C9.4 39.5 16.1 44 24 44z"
        fill="#4CAF50"
      />
      <path
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.3 4.5-4 5.9l.1-.1 6.3 5.3C37.2 38.8 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
        fill="#1976D2"
      />
    </svg>
  );
}

function GithubMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-8 w-8"
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 .5C5.65.5.5 5.66.5 12.02c0 5.09 3.3 9.41 7.88 10.94.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.11-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.71 1.26 3.37.97.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.72 0-1.26.45-2.3 1.19-3.11-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.19 1.19a10.93 10.93 0 0 1 5.8 0c2.21-1.5 3.18-1.19 3.18-1.19.64 1.59.24 2.77.12 3.06.74.81 1.18 1.85 1.18 3.11 0 4.45-2.69 5.42-5.26 5.7.41.36.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.21.68.8.56a11.53 11.53 0 0 0 7.87-10.94C23.5 5.66 18.35.5 12 .5Z" />
    </svg>
  );
}

function SignupEmailPanel({
  email,
  onEmailChange,
  onVerificationStarted,
  onVerificationCodeSent,
}: SignupEmailPanelProps) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim();
    const emailError = validateEmail(normalizedEmail);

    if (emailError) {
      setFieldErrors({ email: emailError });
      return;
    }

    setIsSubmitting(true);

    try {
      const emailCheckResult = await checkEmailAvailability(normalizedEmail);

      if (!emailCheckResult.available) {
        setFieldErrors({
          email: '이미 가입된 이메일 입니다.',
        });
        return;
      }

      await sendEmailVerificationCode({ email: normalizedEmail });
      onVerificationCodeSent(normalizedEmail);
      onVerificationStarted(normalizedEmail);
    } catch (error) {
      const serverFieldErrors = getApiFieldErrors(error);

      if (Object.keys(serverFieldErrors).length > 0) {
        setFieldErrors((current) => ({
          ...current,
          ...serverFieldErrors,
        }));
      } else {
        setFieldErrors({
          email: getTooManyRequestsMessage(
            error,
            '인증 번호 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
          ),
        });
      }
    } finally {
      setIsSubmitting(false);
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

        <div className="mt-[clamp(2rem,5.6vh,3.5rem)] space-y-[clamp(0.875rem,2vh,1.25rem)]">
          <AuthField
            autoComplete="email"
            errorMessage={fieldErrors.email}
            label="EMAIL ADDRESS"
            onChange={(event) => {
              onEmailChange(event.target.value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            placeholder="Email Address"
            value={email}
          />
        </div>

        <div className="my-[clamp(1.6rem,4vh,2.4rem)] flex items-center gap-4 text-[#d4d4d4]">
          <span className="h-px flex-1 bg-[#dfdfdf]" />
          <span className="text-sm font-semibold tracking-[0.25em] text-[#d7d7d7]">OR</span>
          <span className="h-px flex-1 bg-[#dfdfdf]" />
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <AuthSocialButton icon={<GithubMark />} label="Github로 시작하기" />
          <AuthSocialButton icon={<GoogleMark />} label="Google로 시작하기" />
        </div>

        <div className="mt-[clamp(2.5rem,6vh,4.25rem)] space-y-[clamp(0.875rem,2vh,1.25rem)]">
          <AuthButton isLoading={isSubmitting} type="submit">
            Continue
          </AuthButton>

          <p className="auth-body-text text-black">
            가입함으로써 팀 및 데이터 정책에 동의합니다.
          </p>
        </div>
      </div>
    </form>
  );
}

export default SignupEmailPanel;
