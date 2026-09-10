export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 128;

export interface LoginFieldErrors {
  email?: string;
  password?: string;
}

export interface PasswordChangeFieldErrors {
  confirmation?: string;
  currentPassword?: string;
  newPassword?: string;
}

export const passwordCodePointLength = (password: string): number =>
  // oxlint-disable-next-line unicorn/prefer-spread -- auth contract counts Unicode code points, not grapheme clusters.
  Array.from(password).length;

export const isEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);

export const validateLogin = (
  email: string,
  password: string
): LoginFieldErrors => {
  const errors: LoginFieldErrors = {};

  if (email.trim().length === 0) {
    errors.email = "Enter your email address.";
  } else if (!isEmail(email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (password.length === 0) {
    errors.password = "Enter your password.";
  }

  return errors;
};

export const validatePasswordChange = (
  currentPassword: string,
  newPassword: string,
  confirmation: string
): PasswordChangeFieldErrors => {
  const errors: PasswordChangeFieldErrors = {};
  const length = passwordCodePointLength(newPassword);

  if (currentPassword.length === 0) {
    errors.currentPassword = "Enter your current password.";
  }

  if (length < MIN_PASSWORD_LENGTH || length > MAX_PASSWORD_LENGTH) {
    errors.newPassword = `New password must contain ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} Unicode characters.`;
  }

  if (confirmation !== newPassword) {
    errors.confirmation = "Passwords do not match.";
  }

  return errors;
};
