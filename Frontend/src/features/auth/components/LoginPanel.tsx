import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage, getApiFieldErrors } from '../../../api/error';
import { ROUTES } from '../../../constants/routes';
import { useAuthStore } from '../../../store/authStore';
import type { LoginFormValues } from '../../../types/auth';
import { loginWithEmail } from '../api/member';
import {
  initialLoginFormValues,
  validateEmail,
  validatePassword,
} from '../utils/signup';
import AuthButton from './AuthButton';
import AuthField from './AuthField';
import AuthMessage from './AuthMessage';
import AuthPanelHeading from './AuthPanelHeading';
import ForgotPasswordModal from './ForgotPasswordModal';

type LoginFieldErrors = Partial<Record<keyof LoginFormValues, string>>;

function LoginPanel() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [values, setValues] = useState<LoginFormValues>(initialLoginFormValues);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setFieldValue = <K extends keyof LoginFormValues>(field: K, value: LoginFormValues[K]) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setErrorMessage(null);
  };

  const validateForm = () => {
    const nextFieldErrors: LoginFieldErrors = {
      email: validateEmail(values.email),
      password: validatePassword(values.password),
    };
    const hasError = Object.values(nextFieldErrors).some(Boolean);

    if (hasError) {
      setFieldErrors(nextFieldErrors);
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const tokenData = await loginWithEmail({
        email: values.email.trim(),
        password: values.password,
      });

      login({
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        user: {
          id: values.email.trim(),
          email: values.email.trim(),
          role: 'USER',
        },
      });
      navigate(ROUTES.projects);
    } catch (error) {
      setFieldErrors((current) => ({
        ...current,
        ...getApiFieldErrors(error),
      }));
      setErrorMessage(getApiErrorMessage(error, 'Email or password is incorrect.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form
        className="w-full"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <div>
          <AuthPanelHeading subtitle="SSAFER.io" title="Login" />

          <div className="mt-[clamp(2rem,5.6vh,3.5rem)] space-y-[clamp(0.875rem,2vh,1.25rem)]">
            <AuthField
              autoComplete="email"
              errorMessage={fieldErrors.email}
              label="EMAIL ADDRESS"
              onChange={(event) => setFieldValue('email', event.target.value)}
              placeholder="Email Address"
              value={values.email}
            />
            <AuthField
              autoComplete="current-password"
              errorMessage={fieldErrors.password}
              label="Password"
              onChange={(event) => setFieldValue('password', event.target.value)}
              placeholder="Password"
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
              value={values.password}
            />
            <button
              className="auth-body-text pt-1 text-left text-black transition hover:text-[#757579]"
              onClick={() => setIsForgotPasswordOpen(true)}
              type="button"
            >
              Forgot your password
            </button>
          </div>

          {errorMessage ? (
            <div className="mt-[clamp(1.25rem,1.83vh,2.1875rem)]">
              <AuthMessage message={errorMessage} tone="error" />
            </div>
          ) : null}

          <div className="mt-[clamp(2.5rem,6vh,4.25rem)]">
            <AuthButton isLoading={isSubmitting} type="submit">
              Login
            </AuthButton>
          </div>
        </div>
      </form>

      {isForgotPasswordOpen ? (
        <ForgotPasswordModal
          initialEmail={values.email}
          onClose={() => setIsForgotPasswordOpen(false)}
        />
      ) : null}
    </>
  );
}

export default LoginPanel;
