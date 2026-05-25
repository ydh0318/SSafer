import { useEffect, useState } from 'react';

import AuthShell from '../../features/auth/components/AuthShell';
import EmailVerificationPanel from '../../features/auth/components/EmailVerificationPanel';
import LoginPanel from '../../features/auth/components/LoginPanel';
import SignupPanel, { type SignupStage } from '../../features/auth/components/SignupPanel';
import SignupProfilePanel from '../../features/auth/components/SignupProfilePanel';
import { SESSION_EXPIRED_STORAGE_KEY } from '../../features/auth/utils/session';
import { initialSignupFormValues } from '../../features/auth/utils/signup';
import { useToast } from '../../features/feedback/useToast';
import type { SignupFormValues } from '../../types/auth';

function EntryPage() {
  const [signupStage, setSignupStage] = useState<SignupStage>('email');
  const [signupValues, setSignupValues] = useState<SignupFormValues>(initialSignupFormValues);
  const toast = useToast();

  useEffect(() => {
    const sessionExpiredMessage = window.sessionStorage.getItem(SESSION_EXPIRED_STORAGE_KEY);

    if (!sessionExpiredMessage) {
      return;
    }

    toast.info(sessionExpiredMessage);
    window.sessionStorage.removeItem(SESSION_EXPIRED_STORAGE_KEY);
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
        onCodeResent={(email) => toast.success(`${email}로 인증 코드를 다시 보냈습니다.`)}
        onVerified={() => setSignupStage('profile')}
      />
    ) : signupStage === 'profile' ? (
      <SignupProfilePanel
        onBack={() => setSignupStage('email')}
        onChange={updateSignupValue}
        onCompleted={() => {
          toast.success('회원가입이 완료되었습니다. 로그인해 주세요.');
          resetSignupFlow();
        }}
        values={signupValues}
      />
    ) : (
      <LoginPanel />
    );

  return (
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
            onVerificationCodeSent={(email) => toast.success(`${email}로 인증 코드를 보냈습니다.`)}
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
  );
}

export default EntryPage;
