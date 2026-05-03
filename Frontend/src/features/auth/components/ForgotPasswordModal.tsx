import { Eye, EyeOff, X } from 'lucide-react';
import { useState } from 'react';

import { validateCode, validateEmail, validatePassword } from '../utils/signup';
import AuthButton from './AuthButton';
import AuthField from './AuthField';
import AuthMessage from './AuthMessage';

type ForgotPasswordModalProps = {
  initialEmail?: string;
  onClose: () => void;
};

type ModalStep = 'email' | 'change';

type ModalFieldErrors = Partial<{
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}>;

function ForgotPasswordModal({ initialEmail = '', onClose }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<ModalStep>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ModalFieldErrors>({});
  const [message, setMessage] = useState<{
    tone: 'error' | 'success' | 'info';
    text: string;
  } | null>(null);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<'send' | 'verify' | 'change' | null>(null);

  const clearFieldError = (field: keyof ModalFieldErrors) => {
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setMessage(null);

    if (field === 'code') {
      setIsCodeVerified(false);
    }
  };

  const handleSendCode = async () => {
    const emailError = validateEmail(email);

    if (emailError) {
      setFieldErrors((current) => ({ ...current, email: emailError }));
      return;
    }

    setPendingAction('send');
    setMessage(null);

    setStep('change');
    setPendingAction(null);
  };

  const handleVerifyCode = async () => {
    const codeError = validateCode(code);

    if (codeError) {
      setFieldErrors((current) => ({ ...current, code: codeError }));
      return;
    }

    setPendingAction('verify');
    setMessage(null);

    setIsCodeVerified(true);
    setMessage({
      tone: 'info',
      text: '비밀번호 찾기용 코드 확인 API가 준비되면 실제 인증으로 연결할 수 있습니다.',
    });
    setPendingAction(null);
  };

  const validatePasswordForm = () => {
    const nextFieldErrors: ModalFieldErrors = {
      newPassword: validatePassword(newPassword),
      confirmPassword:
        newPassword === confirmPassword ? '' : '비밀번호가 서로 일치하지 않습니다.',
    };

    if (Object.values(nextFieldErrors).some(Boolean)) {
      setFieldErrors((current) => ({
        ...current,
        ...nextFieldErrors,
      }));
      return false;
    }

    return true;
  };

  const handleChangePassword = async () => {
    if (!isCodeVerified) {
      setMessage({
        tone: 'info',
        text: '먼저 인증 코드를 확인해 주세요.',
      });
      return;
    }

    if (!validatePasswordForm()) {
      return;
    }

    setPendingAction('change');
    setMessage({
      tone: 'info',
      text: '현재 제공된 API는 로그인된 사용자의 현재 비밀번호 변경용입니다. 이메일 코드 기반 재설정 API가 추가되면 이 버튼에 바로 연결할 수 있습니다.',
    });
    setPendingAction(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/55 backdrop-blur-[2px]">
      <section className="relative h-[min(92vh,860px)] w-[min(92vw,690px)] rounded-lg bg-[#f7f7f7] shadow-[0_0_48px_rgba(0,0,0,0.12)]">
        <header className="flex h-14 items-center justify-center border-b border-black/5 px-6">
          <button
            aria-label="Close forgot password modal"
            className="absolute left-6 top-4 text-black transition hover:opacity-60"
            onClick={onClose}
            type="button"
          >
            <X className="h-7 w-7" strokeWidth={2.2} />
          </button>
          <p className="text-base font-black uppercase tracking-[0.04em]">Forgot Password</p>
        </header>

        {step === 'email' ? (
          <form
            className="mx-auto mt-12 w-[min(74%,430px)]"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSendCode();
            }}
          >
            <h2 className="text-[32px] font-black uppercase leading-[0.96] tracking-[0.02em]">
              Forgot
              <br />
              Your Password?
            </h2>
            <p className="mt-6 text-base font-medium text-black">
              Enter your account email to reset your password
            </p>

            <div className="mt-7">
              <AuthField
                autoComplete="email"
                errorMessage={fieldErrors.email}
                label="EMAIL ADDRESS"
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearFieldError('email');
                }}
                placeholder="Email Address"
                value={email}
              />
            </div>

            {message ? (
              <div className="mt-5">
                <AuthMessage message={message.text} tone={message.tone} />
              </div>
            ) : null}

            <div className="mt-8">
              <AuthButton isLoading={pendingAction === 'send'} type="submit">
                Continue
              </AuthButton>
            </div>
          </form>
        ) : (
          <form
            className="mx-auto mt-14 w-[min(74%,430px)]"
            onSubmit={(event) => {
              event.preventDefault();
              void handleChangePassword();
            }}
          >
            <h2 className="text-[32px] font-black uppercase leading-none tracking-[0.02em]">
              Change Password
            </h2>
            <p className="mt-7 text-lg font-medium leading-7 text-black">
              We just send a code to your email.
              <br />
              Please verify the code number.
            </p>

            <div className="mt-5">
              <div className="grid grid-cols-[1fr_104px]">
                <AuthField
                  errorMessage={fieldErrors.code}
                  inputMode="numeric"
                  label="CODE"
                  maxLength={6}
                  onChange={(event) => {
                    setCode(event.target.value);
                    clearFieldError('code');
                  }}
                  placeholder="Code"
                  value={code}
                />
                <div className="self-end">
                  <AuthButton
                    className="h-[clamp(2.875rem,min(3.55vw,6vh),3.75rem)] px-2 text-sm"
                    isLoading={pendingAction === 'verify'}
                    onClick={() => void handleVerifyCode()}
                    type="button"
                  >
                    Verify
                  </AuthButton>
                </div>
              </div>
            </div>

            <hr className="my-8 border-[#d9d9d9]" />

            <p className="text-lg font-medium leading-7 text-black">
              Please set it to a different password than before.
              <br />
              Mix letters, numbers, and symbols to make them at least 8 characters.
            </p>

            <div className="mt-6 space-y-5">
              <AuthField
                autoComplete="new-password"
                errorMessage={fieldErrors.newPassword}
                label="NEW PASSWORD"
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  clearFieldError('newPassword');
                }}
                placeholder="New password"
                trailing={
                  <button
                    className="auth-body-text inline-flex items-center gap-1 text-[#c3c3c3]"
                    onClick={() => setIsPasswordVisible((current) => !current)}
                    type="button"
                  >
                    {isPasswordVisible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    show
                  </button>
                }
                type={isPasswordVisible ? 'text' : 'password'}
                value={newPassword}
              />
              <AuthField
                autoComplete="new-password"
                errorMessage={fieldErrors.confirmPassword}
                label="CONFIRM PASSWORD"
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  clearFieldError('confirmPassword');
                }}
                placeholder="Confirm password"
                trailing={
                  <button
                    className="auth-body-text inline-flex items-center gap-1 text-[#c3c3c3]"
                    onClick={() => setIsConfirmPasswordVisible((current) => !current)}
                    type="button"
                  >
                    {isConfirmPasswordVisible ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    show
                  </button>
                }
                type={isConfirmPasswordVisible ? 'text' : 'password'}
                value={confirmPassword}
              />
            </div>

            {message ? (
              <div className="mt-5">
                <AuthMessage message={message.text} tone={message.tone} />
              </div>
            ) : null}

            <div className="mt-8">
              <AuthButton isLoading={pendingAction === 'change'} type="submit">
                Change Password
              </AuthButton>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

export default ForgotPasswordModal;
