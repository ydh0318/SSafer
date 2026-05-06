import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import { getApiErrorMessage, getApiFieldErrors } from '../../../api/error';
import type { SignupFormValues } from '../../../types/auth';
import { checkNicknameAvailability, registerUser } from '../api/member';
import {
  validateDisplayName,
  validatePassword,
  validatePasswordConfirmation,
} from '../utils/signup';
import AuthButton from './AuthButton';
import AuthField from './AuthField';
import AuthMessage from './AuthMessage';

type FieldErrors = Partial<Record<keyof SignupFormValues, string>>;

type SignupProfilePanelProps = {
  values: SignupFormValues;
  onBack: () => void;
  onChange: <K extends keyof SignupFormValues>(field: K, value: SignupFormValues[K]) => void;
  onCompleted: () => void;
};

function SignupProfilePanel({ values, onBack, onChange, onCompleted }: SignupProfilePanelProps) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{
    tone: 'error' | 'success';
    text: string;
  } | null>(null);
  const [displayNameCheckMessage, setDisplayNameCheckMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingDisplayName, setIsCheckingDisplayName] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isDisplayNameConfirmed, setIsDisplayNameConfirmed] = useState(false);

  const handleDisplayNameCheck = async () => {
    const displayNameError = validateDisplayName(values.displayName);

    if (displayNameError) {
      setFieldErrors((current) => ({
        ...current,
        displayName: displayNameError,
      }));
      setDisplayNameCheckMessage(null);
      setIsDisplayNameConfirmed(false);
      return;
    }

    setIsCheckingDisplayName(true);
    setFieldErrors((current) => ({
      ...current,
      displayName: undefined,
    }));
    setDisplayNameCheckMessage(null);
    setMessage(null);

    try {
      const result = await checkNicknameAvailability(values.displayName.trim());

      if (result.available) {
        setDisplayNameCheckMessage('사용 가능한 닉네임입니다.');
        setIsDisplayNameConfirmed(true);
        return;
      }

      setFieldErrors((current) => ({
        ...current,
        displayName: '이미 사용 중인 닉네임입니다.',
      }));
      setIsDisplayNameConfirmed(false);
    } catch (error) {
      setFieldErrors((current) => ({
        ...current,
        ...getApiFieldErrors(error),
      }));
      setMessage({
        tone: 'error',
        text: getApiErrorMessage(error, '닉네임 중복 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.'),
      });
      setIsDisplayNameConfirmed(false);
    } finally {
      setIsCheckingDisplayName(false);
    }
  };

  const handleSubmit = async () => {
    const nextFieldErrors: FieldErrors = {
      displayName: validateDisplayName(values.displayName),
      password: validatePassword(values.password),
      confirmPassword: validatePasswordConfirmation(values.password, values.confirmPassword),
    };
    const hasError = Object.values(nextFieldErrors).some(Boolean);

    if (hasError) {
      setFieldErrors(nextFieldErrors);
      setIsDisplayNameConfirmed(false);
      setDisplayNameCheckMessage(null);
      return;
    }

    if (!isDisplayNameConfirmed) {
      setFieldErrors((current) => ({
        ...current,
        displayName: '닉네임 중복 확인을 먼저 진행해 주세요.',
      }));
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      await registerUser({
        email: values.email.trim(),
        displayName: values.displayName.trim(),
        password: values.password,
        code: values.code.trim(),
      });
      onCompleted();
    } catch (error) {
      setFieldErrors((current) => ({
        ...current,
        ...getApiFieldErrors(error),
      }));
      setMessage({
        tone: 'error',
        text: getApiErrorMessage(error, '회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.'),
      });
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
      <button
        className="mb-[clamp(0.875rem,1.8vh,1.25rem)] auth-back-button"
        onClick={onBack}
        type="button"
      >
        &lt; BACK
      </button>

      <div className="space-y-4">
        <header className="space-y-2">
          <h2 className="text-[clamp(1.9rem,min(2.05vw,4.3vh),2.7rem)] font-black leading-[1.08] tracking-[-0.04em] text-black">
            Ok, Let&apos;s complete the last step.
          </h2>
          <p className="auth-body-text text-[#6f6f6f]">
            회원가입을 완료하기 전에 사용할 닉네임과 비밀번호를 설정해 주세요.
          </p>
        </header>

        <div className="space-y-4">
          <div className="space-y-2">
            <span className="auth-label text-black">USERNAME</span>

            <div className="flex items-stretch">
              <input
                autoComplete="nickname"
                className={`auth-input min-w-0 flex-1 border-r-0 px-[3.54%] text-black outline-none transition placeholder:text-[#afafaf] focus:border-black ${
                  fieldErrors.displayName ? 'border-rose-500' : 'border-slate-200'
                }`}
                maxLength={100}
                onChange={(event) => {
                  onChange('displayName', event.target.value);
                  setFieldErrors((current) => ({ ...current, displayName: undefined }));
                  setDisplayNameCheckMessage(null);
                  setIsDisplayNameConfirmed(false);
                  setMessage(null);
                }}
                placeholder="Username"
                value={values.displayName}
              />
              <button
                className="auth-button w-[9rem] shrink-0 border border-black bg-black px-4 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isCheckingDisplayName}
                onClick={() => void handleDisplayNameCheck()}
                type="button"
              >
                {isCheckingDisplayName ? '확인 중...' : '중복 확인'}
              </button>
            </div>

            {fieldErrors.displayName ? (
              <p className="text-sm font-medium text-rose-600">{fieldErrors.displayName}</p>
            ) : displayNameCheckMessage ? (
              <p className="text-sm font-medium text-blue-600">{displayNameCheckMessage}</p>
            ) : null}

            <div className="space-y-1 text-[0.98rem] leading-7 text-black">
              <p>- 닉네임은 3자 이상 100자 이하로 입력해 주세요.</p>
            </div>
          </div>

          <div className="border-t border-dashed border-[#cfcfcf] pt-4">
            <div className="space-y-3">
              <AuthField
                autoComplete="new-password"
                errorMessage={fieldErrors.password}
                label="PASSWORD"
                onChange={(event) => {
                  onChange('password', event.target.value);
                  setFieldErrors((current) => ({
                    ...current,
                    password: undefined,
                    confirmPassword: undefined,
                  }));
                  setMessage(null);
                }}
                placeholder="Password"
                trailing={
                  <button
                    className="auth-body-text inline-flex items-center gap-1 text-[#c3c3c3]"
                    onClick={() => setIsPasswordVisible((current) => !current)}
                    type="button"
                  >
                    {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    show
                  </button>
                }
                type={isPasswordVisible ? 'text' : 'password'}
                value={values.password}
              />
              <AuthField
                autoComplete="new-password"
                errorMessage={fieldErrors.confirmPassword}
                label="CONFIRM PASSWORD"
                onChange={(event) => {
                  onChange('confirmPassword', event.target.value);
                  setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
                  setMessage(null);
                }}
                placeholder="Confirm Password"
                trailing={
                  <button
                    className="auth-body-text inline-flex items-center gap-1 text-[#c3c3c3]"
                    onClick={() => setIsConfirmPasswordVisible((current) => !current)}
                    type="button"
                  >
                    {isConfirmPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    show
                  </button>
                }
                type={isConfirmPasswordVisible ? 'text' : 'password'}
                value={values.confirmPassword}
              />

              <div className="space-y-1 text-[0.98rem] leading-7 text-black">
                <p>- 비밀번호는 8자 이상 72자 이하로 입력해 주세요.</p>
              </div>
            </div>
          </div>
        </div>

        {message ? <AuthMessage message={message.text} tone={message.tone} /> : null}

        <div className="space-y-3 border-t border-dashed border-[#cfcfcf] pt-4">
          <p className="auth-body-text text-black">
            입력한 정보가 맞는지 확인한 뒤 회원가입을 완료해 주세요.
          </p>
          <AuthButton isLoading={isSubmitting} type="submit">
            Register
          </AuthButton>
        </div>
      </div>
    </form>
  );
}

export default SignupProfilePanel;
