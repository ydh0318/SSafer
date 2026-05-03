import type { LoginFormValues, SignupFormValues } from '../../../types/auth';

export const initialLoginFormValues: LoginFormValues = {
  email: '',
  password: '',
};

export const initialSignupFormValues: SignupFormValues = {
  email: '',
  code: '',
  displayName: '',
  password: '',
};

export function validateEmail(email: string) {
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    return '이메일은 필수입니다.';
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(normalizedEmail)) {
    return '올바른 이메일 형식이어야 합니다.';
  }

  return '';
}

export function validateCode(code: string) {
  const normalizedCode = code.trim();

  if (!normalizedCode) {
    return '인증 코드는 필수입니다.';
  }

  if (!/^\d{6}$/.test(normalizedCode)) {
    return '인증 코드는 6자리 숫자여야 합니다.';
  }

  return '';
}

export function validateDisplayName(displayName: string) {
  const normalizedDisplayName = displayName.trim();

  if (!normalizedDisplayName) {
    return '사용자명은 필수입니다.';
  }

  if (normalizedDisplayName.length > 100) {
    return '사용자명은 100자 이하여야 합니다.';
  }

  return '';
}

export function validatePassword(password: string) {
  if (!password) {
    return '비밀번호는 필수입니다.';
  }

  if (password.length < 8 || password.length > 72) {
    return '비밀번호는 8자 이상 72자 이하여야 합니다.';
  }

  return '';
}
