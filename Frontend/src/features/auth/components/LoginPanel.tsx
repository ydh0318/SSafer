import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import { initialLoginFormValues, validateEmail, validatePassword } from '../utils/signup';
import AuthButton from './AuthButton';
import AuthField from './AuthField';
import AuthPanelHeading from './AuthPanelHeading';

function LoginPanel() {
  const [values, setValues] = useState(initialLoginFormValues);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setFieldValue = (field: 'email' | 'password', value: string) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const handleSubmit = async () => {
    const nextFieldErrors = {
      email: validateEmail(values.email),
      password: validatePassword(values.password),
    };
    const hasError = Object.values(nextFieldErrors).some(Boolean);

    if (hasError) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setIsSubmitting(true);
    await Promise.resolve();
    setIsSubmitting(false);
  };

  return (
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
            label="PASSWORD"
            onChange={(event) => setFieldValue('password', event.target.value)}
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
          <button
            className="auth-body-text pt-1 text-left text-black transition hover:text-[#757579]"
            type="button"
          >
            Forgot your password
          </button>
        </div>

        <div className="mt-[clamp(2.5rem,6vh,4.25rem)]">
          <AuthButton isLoading={isSubmitting} type="submit">
            Login
          </AuthButton>
        </div>
      </div>
    </form>
  );
}

export default LoginPanel;
