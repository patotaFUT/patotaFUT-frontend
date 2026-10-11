import { authContent } from './auth.content';
import type {
  FieldErrors,
  LoginFields,
  RegisterFields,
  RegisterFieldErrors,
  RegisterRequest,
} from './auth.contracts';
import type { ResetFields, ResetFieldErrors } from './recovery.contracts';

// Mirrors the existing API Service; these limits are not additional RN.
const limits = Object.freeze({
  name: 100,
  email: 254,
  passwordMinimum: 12,
  passwordBytes: 1024,
});

export function validateLogin(fields: LoginFields): FieldErrors {
  const errors: FieldErrors = {};
  if (
    fields.email.length > limits.email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)
  )
    errors.email = authContent.emailInvalid;
  if (fields.password.length === 0)
    errors.password = authContent.passwordRequired;
  else if (
    new TextEncoder().encode(fields.password).length > limits.passwordBytes
  )
    errors.password = authContent.passwordTooLong;
  return errors;
}

export function validateRegister(fields: RegisterFields): RegisterFieldErrors {
  const errors: RegisterFieldErrors = validateLogin(fields);
  if (
    fields.firstName.trim().length === 0 ||
    fields.firstName.length > limits.name
  )
    errors.firstName = authContent.firstNameInvalid;
  if (
    fields.lastName.trim().length === 0 ||
    fields.lastName.length > limits.name
  )
    errors.lastName = authContent.lastNameInvalid;
  if (
    fields.password.length > 0 &&
    fields.password.length < limits.passwordMinimum
  )
    errors.password = authContent.passwordTooShort;
  if (fields.confirmPassword.length === 0)
    errors.confirmPassword = authContent.confirmationRequired;
  else if (fields.confirmPassword !== fields.password)
    errors.confirmPassword = authContent.confirmationMismatch;
  return errors;
}

export function toRegisterRequest(fields: RegisterFields): RegisterRequest {
  return {
    firstName: fields.firstName,
    lastName: fields.lastName,
    email: fields.email,
    password: fields.password,
  };
}

export function validateRecoveryEmail(email: string): string | undefined {
  return email.length <= limits.email &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? undefined
    : authContent.emailInvalid;
}
export function validateReset(fields: ResetFields): ResetFieldErrors {
  const errors: ResetFieldErrors = {};
  if (fields.password.length < limits.passwordMinimum)
    errors.password = authContent.passwordTooShort;
  else if (
    new TextEncoder().encode(fields.password).length > limits.passwordBytes
  )
    errors.password = authContent.passwordTooLong;
  if (fields.confirmPassword.length === 0)
    errors.confirmPassword = authContent.confirmationRequired;
  else if (fields.password !== fields.confirmPassword)
    errors.confirmPassword = authContent.confirmationMismatch;
  return errors;
}
