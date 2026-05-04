import { useEffect, useState } from 'react';

import AuthShell from '../../features/auth/components/AuthShell';
import AuthToast from '../../features/auth/components/AuthToast';
import EmailVerificationPanel from '../../features/auth/components/EmailVerificationPanel';
import LoginPanel from '../../features/auth/components/LoginPanel';
import SignupPanel, { type SignupStage } from '../../features/auth/components/SignupPanel';
import SignupProfilePanel from '../../features/auth/components/SignupProfilePanel';
import { initialSignupFormValues } from '../../features/auth/utils/signup';
import type { SignupFormValues } from '../../types/auth';

function EntryPage() {
  const [signupStage, setSignupStage] = useState<SignupStage>('email');
  const [signupValues, setSignupValues] = useState<SignupFormValues>(initialSignupFormValues);
  const [toast, setToast] = useState<{
    tone: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const updateSignupValue = <K extends keyof SignupFormValues>(
    field: K,
    value: SignupFormValues[K],
  ) => {
    setSignupValues((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const resetSignupFlow = () => {
    setSignupStage('email');
    setSignupValues(initialSignupFormValues);
  };

  const leftPanel =
    signupStage === 'verification' ? (
      <EmailVerificationPanel
        email={signupValues.email}
        onBack={() => setSignupStage('email')}
        onCodeResent={(email) =>
          setToast({
            tone: 'success',
            message: `${email}로 인증 코드를 다시 보냈습니다.`,
          })
        }
        onVerified={() => setSignupStage('profile')}
      />
    ) : signupStage === 'profile' ? (
      <SignupProfilePanel
        onBack={() => setSignupStage('email')}
        onChange={updateSignupValue}
        onCompleted={() => {
          setToast({
            tone: 'success',
            message: '회원가입이 완료되었습니다. 로그인해 주세요.',
          });
          resetSignupFlow();
        }}
        values={signupValues}
      />
    ) : (
      <LoginPanel />
    );

  return (
    <>
      <AuthShell
        contentClassName={signupStage === 'profile' ? 'items-start pt-6' : undefined}
        frameClassName={signupStage === 'profile' ? 'auth-frame-top' : undefined}
        left={leftPanel}
        leftClassName={signupStage === 'profile' ? 'auth-single-slot-compact' : undefined}
        right={
          signupStage === 'email' ? (
            <SignupPanel
              email={signupValues.email}
              onEmailChange={(email) => updateSignupValue('email', email)}
              onVerificationCodeSent={(email) =>
                setToast({
                  tone: 'success',
                  message: `${email}로 인증 코드를 보냈습니다.`,
                })
              }
              onVerificationStarted={(email) => {
                setSignupValues((current) => ({
                  ...current,
                  email,
                  code: '',
                  displayName: '',
                  password: '',
                  confirmPassword: '',
                }));
                setSignupStage('verification');
              }}
            />
          ) : undefined
        }
      />

      {toast ? (
        <div className="pointer-events-none fixed right-6 top-6 z-50">
          <AuthToast message={toast.message} onClose={() => setToast(null)} tone={toast.tone} />
        </div>
      ) : null}
    </>
  );
}

export default EntryPage;
