import { useState } from 'react';

import AuthShell from '../../features/auth/components/AuthShell';
import EmailVerificationPanel from '../../features/auth/components/EmailVerificationPanel';
import LoginPanel from '../../features/auth/components/LoginPanel';
import SignupPanel, { type SignupStage } from '../../features/auth/components/SignupPanel';

function EntryPage() {
  const [signupStage, setSignupStage] = useState<SignupStage>('email');
  const [verificationEmail, setVerificationEmail] = useState('');

  const leftPanel =
    signupStage === 'verification' ? (
      <EmailVerificationPanel
        email={verificationEmail}
        onBack={() => {
          setVerificationEmail('');
          setSignupStage('email');
        }}
        onVerified={() => setSignupStage('profile')}
      />
    ) : (
      <LoginPanel />
    );

  if (signupStage === 'verification') {
    return <AuthShell left={leftPanel} />;
  }

  return (
    <AuthShell
      left={leftPanel}
      right={
        <SignupPanel
          onVerificationStarted={(email) => {
            setVerificationEmail(email);
            setSignupStage('verification');
          }}
          setStage={setSignupStage}
          stage={signupStage}
        />
      }
    />
  );
}

export default EntryPage;
