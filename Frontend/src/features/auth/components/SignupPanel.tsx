import SignupEmailPanel from './SignupEmailPanel';

export type SignupStage = 'email' | 'verification' | 'profile' | 'complete';

type SignupPanelProps = {
  email: string;
  onEmailChange: (email: string) => void;
  onVerificationCodeSent: (email: string) => void;
  onVerificationStarted: (email: string) => void;
};

function SignupPanel(props: SignupPanelProps) {
  return <SignupEmailPanel {...props} />;
}

export default SignupPanel;
