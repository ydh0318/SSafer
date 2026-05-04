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
  confirmPassword: '',
};

export function validateEmail(email: string) {
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    return '이메일을 입력해 주세요.';
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(normalizedEmail)) {
    return '올바른 이메일 형식으로 입력해 주세요.';
  }

  return '';
}

export function validateCode(code: string) {
  const normalizedCode = code.trim();

  if (!normalizedCode) {
    return '인증번호를 입력해 주세요.';
  }

  if (!/^\d{6}$/.test(normalizedCode)) {
    return '인증번호는 6자리 숫자로 입력해 주세요.';
  }

  return '';
}

export function validateDisplayName(displayName: string) {
  const normalizedDisplayName = displayName.trim();

  if (!normalizedDisplayName) {
    return '닉네임을 입력해 주세요.';
  }

  if (normalizedDisplayName.length < 3) {
    return '닉네임은 3자 이상 입력해 주세요.';
  }

  if (normalizedDisplayName.length > 100) {
    return '닉네임은 100자 이하로 입력해 주세요.';
  }

  return '';
}

export function validatePassword(password: string) {
  if (!password) {
    return '비밀번호를 입력해 주세요.';
  }

  if (password.length < 8 || password.length > 72) {
    return '비밀번호는 8자 이상 72자 이하로 입력해 주세요.';
  }

  return '';
}

export function validatePasswordConfirmation(password: string, confirmPassword: string) {
  if (!confirmPassword) {
    return '비밀번호 확인을 입력해 주세요.';
  }

  if (password !== confirmPassword) {
    return '비밀번호가 서로 일치하지 않습니다.';
  }

  return '';
}
