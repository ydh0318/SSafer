import { Eye, EyeOff, X } from 'lucide-react';
import { useState } from 'react';

import { getApiFieldErrors } from '../../../api/error';
import {
  completePasswordReset,
  sendPasswordResetCode,
  verifyPasswordResetCode,
} from '../api/member';
import {
  getPasswordResetCompleteErrorMessage,
  getPasswordResetVerifyErrorMessage,
  getTooManyRequestsMessage,
} from '../utils/authError';
import {
  validateCode,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from '../utils/signup';
import AuthButton from './AuthButton';
import AuthField from './AuthField';
import AuthMessage from './AuthMessage';

type ForgotPasswordModalProps = {
  initialEmail?: string;
  onClose: () => void;
};

type ModalStep = 'email' | 'verify' | 'reset' | 'success';

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
  const [resetToken, setResetToken] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ModalFieldErrors>({});
  const [message, setMessage] = useState<{
    tone: 'error' | 'success' | 'info';
    text: string;
  } | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<'send' | 'verify' | 'change' | null>(null);

  const clearFieldError = (field: keyof ModalFieldErrors) => {
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setMessage(null);
  };

  const handleSendCode = async () => {
    const emailError = validateEmail(email);

    if (emailError) {
      setFieldErrors((current) => ({ ...current, email: emailError }));
      return;
    }

    setPendingAction('send');
    setMessage(null);

    try {
      await sendPasswordResetCode({ email: email.trim() });
      setStep('verify');
      setCode('');
      setResetToken('');
      setFieldErrors({});
      setMessage({
        tone: 'success',
        text: '입력한 이메일로 비밀번호 재설정 인증번호를 보냈습니다.',
      });
    } catch (error) {
      const serverFieldErrors = getApiFieldErrors(error);

      if (serverFieldErrors.email) {
        setFieldErrors((current) => ({
          ...current,
          email: serverFieldErrors.email,
        }));
      } else {
        setFieldErrors((current) => ({
          ...current,
          email: getTooManyRequestsMessage(
            error,
            '인증번호 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.',
          ),
        }));
      }
    } finally {
      setPendingAction(null);
    }
  };

  const handleVerifyCode = async () => {
    const codeError = validateCode(code);

    if (codeError) {
      setFieldErrors((current) => ({ ...current, code: codeError }));
      return;
    }

    setPendingAction('verify');
    setMessage(null);

    try {
      const data = await verifyPasswordResetCode({
        email: email.trim(),
        code: code.trim(),
      });

      setResetToken(data.resetToken);
      setStep('reset');
      setFieldErrors({});
      setMessage({
        tone: 'success',
        text: '인증이 완료되었습니다. 새 비밀번호를 설정해 주세요.',
      });
    } catch (error) {
      const serverFieldErrors = getApiFieldErrors(error);

      if (serverFieldErrors.code) {
        setFieldErrors((current) => ({
          ...current,
          code: serverFieldErrors.code,
        }));
      } else {
        setFieldErrors((current) => ({
          ...current,
          code: getPasswordResetVerifyErrorMessage(
            error,
            '인증번호 확인에 실패했습니다. 다시 시도해 주세요.',
          ),
        }));
      }
    } finally {
      setPendingAction(null);
    }
  };

  const validatePasswordForm = () => {
    const nextFieldErrors: ModalFieldErrors = {
      newPassword: validatePassword(newPassword),
      confirmPassword: validatePasswordConfirmation(newPassword, confirmPassword),
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
    if (!resetToken) {
      setMessage({
        tone: 'error',
        text: '비밀번호 재설정 세션이 만료되었습니다. 처음부터 다시 진행해 주세요.',
      });
      return;
    }

    if (!validatePasswordForm()) {
      return;
    }

    setPendingAction('change');
    setMessage(null);

    try {
      await completePasswordReset({
        resetToken,
        newPassword,
      });

      setStep('success');
      setMessage({
        tone: 'success',
        text: '비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요.',
      });
    } catch (error) {
      const serverFieldErrors = getApiFieldErrors(error);

      if (serverFieldErrors.newPassword) {
        setFieldErrors((current) => ({
          ...current,
          newPassword: serverFieldErrors.newPassword,
        }));
      } else {
        setMessage({
          tone: 'error',
          text: getPasswordResetCompleteErrorMessage(
            error,
            '비밀번호 변경에 실패했습니다. 처음부터 다시 시도해 주세요.',
          ),
        });
      }
    } finally {
      setPendingAction(null);
    }
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
              가입한 이메일을 입력하면 비밀번호 재설정 인증번호를 보내드립니다.
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
        ) : step === 'verify' ? (
          <form
            className="mx-auto mt-14 w-[min(74%,430px)]"
            onSubmit={(event) => {
              event.preventDefault();
              void handleVerifyCode();
            }}
          >
            <h2 className="text-[32px] font-black uppercase leading-none tracking-[0.02em]">
              Verify Code
            </h2>
            <p className="mt-7 text-lg font-medium leading-7 text-black">
              입력한 이메일로 보낸 6자리 인증번호를 입력해 주세요.
              <br />
              인증이 완료되면 새 비밀번호를 설정할 수 있습니다.
            </p>

            <div className="mt-5">
              <div className="grid grid-cols-[1fr_104px] gap-0">
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

            {message ? (
              <div className="mt-5">
                <AuthMessage message={message.text} tone={message.tone} />
              </div>
            ) : null}

            <div className="mt-6">
              <button
                className="auth-body-text text-left text-black transition hover:text-[#757579]"
                onClick={() => void handleSendCode()}
                type="button"
              >
                인증번호 다시 보내기
              </button>
            </div>
          </form>
        ) : step === 'reset' ? (
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
              이전 비밀번호와 다른 새 비밀번호를 설정해 주세요.
              <br />
              영문, 숫자, 특수문자를 조합해 8자 이상으로 입력해 주세요.
            </p>

            <hr className="my-8 border-[#d9d9d9]" />

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
        ) : (
          <div className="mx-auto mt-20 flex w-[min(74%,430px)] flex-col items-start">
            <h2 className="text-[32px] font-black uppercase leading-none tracking-[0.02em]">
              Password
              <br />
              Updated
            </h2>
            <p className="mt-6 text-lg font-medium leading-7 text-black">
              비밀번호가 성공적으로 변경되었습니다.
              <br />
              새 비밀번호로 다시 로그인해 주세요.
            </p>

            {message ? (
              <div className="mt-6 w-full">
                <AuthMessage message={message.text} tone={message.tone} />
              </div>
            ) : null}

            <div className="mt-8 w-full">
              <AuthButton onClick={onClose} type="button">
                Back To Login
              </AuthButton>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default ForgotPasswordModal;
