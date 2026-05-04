import { useState } from 'react';

import { getApiFieldErrors } from '../../../api/error';
import type { SignupFormValues } from '../../../types/auth';
import { checkEmailAvailability, sendEmailVerificationCode } from '../api/member';
import { getTooManyRequestsMessage } from '../utils/authError';
import { validateEmail } from '../utils/signup';
import AuthButton from './AuthButton';
import AuthField from './AuthField';
import AuthPanelHeading from './AuthPanelHeading';

type SignupEmailPanelProps = {
  email: string;
  onEmailChange: (email: string) => void;
  onVerificationStarted: (email: string) => void;
  onVerificationCodeSent: (email: string) => void;
};

type FieldErrors = Partial<Record<keyof SignupFormValues, string>>;

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
          email: '이미 가입된 이메일입니다.',
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

        <div className="mt-[clamp(2.5rem,6vh,4.25rem)] space-y-[clamp(0.875rem,2vh,1.25rem)]">
          <AuthButton isLoading={isSubmitting} type="submit">
            Continue
          </AuthButton>

          <p className="auth-body-text text-black">
            회원가입 시 SSAFER의 이용약관 및 데이터 정책에 동의하게 됩니다.
          </p>
        </div>
      </div>
    </form>
  );
}

export default SignupEmailPanel;
