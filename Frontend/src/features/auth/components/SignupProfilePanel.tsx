import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import type { SignupFormValues } from '../../../types/auth';
import {
  validateDisplayName,
  validatePassword,
  validatePasswordConfirmation,
} from '../utils/signup';
import AuthButton from './AuthButton';
import AuthField from './AuthField';

type FieldErrors = Partial<Record<keyof SignupFormValues, string>>;

type SignupProfilePanelProps = {
  values: SignupFormValues;
  onBack: () => void;
  onChange: <K extends keyof SignupFormValues>(field: K, value: SignupFormValues[K]) => void;
  onCompleted: () => void;
};

function SignupProfilePanel({ values, onBack, onChange, onCompleted }: SignupProfilePanelProps) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [displayNameCheckMessage, setDisplayNameCheckMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isDisplayNameConfirmed, setIsDisplayNameConfirmed] = useState(false);

  const handleDisplayNameCheck = () => {
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

    setFieldErrors((current) => ({
      ...current,
      displayName: undefined,
    }));
    setDisplayNameCheckMessage('사용 가능한 닉네임입니다.');
    setIsDisplayNameConfirmed(true);
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
        displayName: '닉네임 확인 버튼을 눌러 확인해 주세요.',
      }));
      return;
    }

    setIsSubmitting(true);
    await Promise.resolve();
    setIsSubmitting(false);
    onCompleted();
  };

  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <button className="mb-[clamp(0.875rem,1.8vh,1.25rem)] auth-back-button" onClick={onBack} type="button">
        &lt; BACK
      </button>

      <div className="space-y-4">
        <header className="space-y-2">
          <h2 className="text-[clamp(1.9rem,min(2.05vw,4.3vh),2.7rem)] font-black leading-[1.08] tracking-[-0.04em] text-black">
            Ok, Let&apos;s complete the last step.
          </h2>
          <p className="auth-body-text text-[#6f6f6f]">
            인증이 완료되었습니다. 닉네임과 비밀번호를 입력해 계정을 마무리해 주세요.
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
                }}
                placeholder="Username"
                value={values.displayName}
              />
              <button
                className="auth-button w-[9rem] shrink-0 border border-black bg-black px-4 text-white transition hover:bg-zinc-800"
                onClick={handleDisplayNameCheck}
                type="button"
              >
                확인
              </button>
            </div>

            {fieldErrors.displayName ? (
              <p className="text-sm font-medium text-rose-600">{fieldErrors.displayName}</p>
            ) : displayNameCheckMessage ? (
              <p className="text-sm font-medium text-blue-600">{displayNameCheckMessage}</p>
            ) : null}

            <div className="space-y-1 text-[0.98rem] leading-7 text-black">
              <p>- 프로필에 표시되는 닉네임으로 사용됩니다.</p>
              <p>- 닉네임은 3자 이상 입력해 주세요.</p>
              <p>- 닉네임은 영문, 숫자, 하이픈(-), 언더스코어(_)를 권장합니다.</p>
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
                }}
                placeholder="Confirm Password"
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
                value={values.confirmPassword}
              />

              <div className="space-y-1 text-[0.98rem] leading-7 text-black">
                <p>- 영문, 숫자, 특수문자를 조합해 8자 이상으로 설정해 주세요.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-dashed border-[#cfcfcf] pt-4">
          <p className="auth-body-text text-black">
            회원가입을 진행하면 서비스 이용약관 및 데이터 정책에 동의하게 됩니다.
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
