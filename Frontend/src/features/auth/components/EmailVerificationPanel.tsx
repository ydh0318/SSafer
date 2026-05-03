import { useState } from 'react';

import { getApiErrorMessage, getApiFieldErrors } from '../../../api/error';
import { sendEmailVerificationCode, verifyEmailCode } from '../api/member';
import { validateCode } from '../utils/signup';
import AuthButton from './AuthButton';
import AuthField from './AuthField';
import AuthMessage from './AuthMessage';

type EmailVerificationPanelProps = {
  email: string;
  onBack: () => void;
  onVerified: () => void;
};

function EmailVerificationPanel({ email, onBack, onVerified }: EmailVerificationPanelProps) {
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>();
  const [message, setMessage] = useState<{
    tone: 'error' | 'success';
    text: string;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<'verify' | 'resend' | null>(null);

  const handleResend = async () => {
    setPendingAction('resend');
    setMessage(null);

    try {
      await sendEmailVerificationCode({ email });
      window.alert(`SSAFER.IO 내용:\n\n"${email}"\n해당 이메일로 인증 코드를 다시 전송했습니다.`);
    } catch (error) {
      setMessage({
        tone: 'error',
        text: getApiErrorMessage(error, '인증 코드 재전송에 실패했습니다.'),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleVerify = async () => {
    const nextCodeError = validateCode(code);

    if (nextCodeError) {
      setCodeError(nextCodeError);
      return;
    }

    setPendingAction('verify');
    setMessage(null);

    try {
      await verifyEmailCode({
        email,
        code: code.trim(),
      });
      setMessage({
        tone: 'success',
        text: '이메일 인증이 완료되었습니다.',
      });
      onVerified();
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error);

      setCodeError(fieldErrors.code);
      setMessage({
        tone: 'error',
        text: getApiErrorMessage(error, '인증 코드가 올바르지 않습니다.'),
      });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        void handleVerify();
      }}
    >
      <div>
        <button
          className="auth-back-button"
          onClick={onBack}
          type="button"
        >
          &lt; BACK
        </button>

        <h2 className="email-verification-title">
          이메일로 인증 번호를 보냈습니다.
          <br />
          코드를 확인해 주세요.
        </h2>

        <div className="mt-[clamp(2rem,5.6vh,3.5rem)] space-y-[clamp(0.875rem,2vh,1.25rem)]">
          <AuthField
            errorMessage={codeError}
            inputMode="numeric"
            label="CODE"
            maxLength={6}
            onChange={(event) => {
              setCode(event.target.value);
              setCodeError(undefined);
              setMessage(null);
            }}
            placeholder="Code"
            value={code}
          />
          <button
            className="auth-body-text pt-1 text-left font-semibold italic text-black underline-offset-4 transition hover:text-zinc-500 hover:underline disabled:opacity-50"
            disabled={pendingAction !== null}
            onClick={() => void handleResend()}
            type="button"
          >
            Resend code
          </button>
        </div>

        {message ? (
          <div className="mt-[clamp(1.25rem,1.83vh,2.1875rem)]">
            <AuthMessage message={message.text} tone={message.tone} />
          </div>
        ) : null}

        <div className="mt-[clamp(2.5rem,6vh,4.25rem)]">
          <AuthButton isLoading={pendingAction === 'verify'} type="submit">
            Verify
          </AuthButton>
        </div>
      </div>
    </form>
  );
}

export default EmailVerificationPanel;
