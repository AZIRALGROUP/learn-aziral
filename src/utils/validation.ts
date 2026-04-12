/**
 * Shared validation rules.
 * Single source of truth — same rules used on frontend and referenced in backend.
 * Open/Closed: add new validators without modifying existing ones.
 */

// ── Rules ─────────────────────────────────────────────────────────────────────
export const PASSWORD_MIN_LENGTH = 8;
export const SPECIAL_CHAR_REGEX  = /[!@#$%^&*(),.?":{}|<>\-_+=[\]\\/]/;
export const EMAIL_REGEX         = /\S+@\S+\.\S+/;

// ── Validators ────────────────────────────────────────────────────────────────
export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email обязателен';
  if (!EMAIL_REGEX.test(email)) return 'Некорректный email';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH)
    return `Пароль минимум ${PASSWORD_MIN_LENGTH} символов`;
  if (!SPECIAL_CHAR_REGEX.test(password))
    return 'Пароль должен содержать хотя бы один спецсимвол';
  return null;
}

export function validateName(name: string): string | null {
  if (!name.trim()) return 'Имя обязательно';
  return null;
}

export function validateRequired(value: string, label = 'Поле'): string | null {
  if (!value.trim()) return `${label} обязательно`;
  return null;
}

// ── Contact form ──────────────────────────────────────────────────────────────
export interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

export function validateContactForm(form: ContactFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  const nameErr    = validateRequired(form.name, 'Имя');
  const emailErr   = validateEmail(form.email);
  const messageErr = validateRequired(form.message, 'Сообщение');
  if (nameErr)    errors.name    = nameErr;
  if (emailErr)   errors.email   = emailErr;
  if (messageErr) errors.message = messageErr;
  return errors;
}

// ── Register form ─────────────────────────────────────────────────────────────
export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export function validateRegisterForm(form: RegisterFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  const nameErr     = validateName(form.name);
  const emailErr    = validateEmail(form.email);
  const passwordErr = validatePassword(form.password);
  if (nameErr)     errors.name     = nameErr;
  if (emailErr)    errors.email    = emailErr;
  if (passwordErr) errors.password = passwordErr;
  if (form.password !== form.confirmPassword)
    errors.confirmPassword = 'Пароли не совпадают';
  return errors;
}
