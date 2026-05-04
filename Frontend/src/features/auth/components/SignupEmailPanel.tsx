import { useState } from 'react';

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

function SignupEmailPanel({
  email,
  onEmailChange,
  onVerificationStarted,
  onVerificationCodeSent,
}: SignupEmailPanelProps) {
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim();
    const emailError = validateEmail(normalizedEmail);

    if (emailError) {
      setFieldError(emailError);
      return;
    }

    setIsSubmitting(true);
    await Promise.resolve();
    setIsSubmitting(false);
    onVerificationCodeSent(normalizedEmail);
    onVerificationStarted(normalizedEmail);
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
            errorMessage={fieldError}
            label="EMAIL ADDRESS"
            onChange={(event) => {
              onEmailChange(event.target.value);
              setFieldError(undefined);
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
            입력한 이메일로 회원가입 인증 코드를 보내드립니다.
          </p>
        </div>
      </div>
    </form>
  );
}

export default SignupEmailPanel;
