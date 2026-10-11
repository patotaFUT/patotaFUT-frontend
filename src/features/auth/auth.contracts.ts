export type UserRole = 'PLAYER' | 'ADMIN' | 'ORGANIZER';
export interface LoginRequest {
  email: string;
  password: string;
}
export interface RegisterRequest extends LoginRequest {
  firstName: string;
  lastName: string;
}
export interface RegisterFields extends RegisterRequest {
  confirmPassword: string;
}
export type RegisterFieldErrors = Partial<Record<keyof RegisterFields, string>>;
export interface GoogleLoginRequest {
  idToken: string;
  firstName?: string;
  lastName?: string;
}
export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}
export interface AuthResponse {
  user: PublicUser;
}
export interface CsrfResponse {
  csrfToken: string;
}
export interface ApiErrorResponse {
  error: string;
  code?: string;
}
export type FailureKind =
  | 'communication'
  | 'authentication'
  | 'request'
  | 'configuration'
  | 'protocol';
export interface AuthFailure {
  kind: FailureKind;
  message: string;
  status?: number;
}
export type SessionState =
  | { status: 'checking' }
  | { status: 'authenticated'; user: PublicUser }
  | { status: 'unauthenticated' }
  | { status: 'error'; error: AuthFailure };
export interface LoginFields {
  email: string;
  password: string;
}
export interface FieldErrors {
  email?: string;
  password?: string;
}
export type AuthOperation = 'idle' | 'local' | 'google' | 'register' | 'logout';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function validString(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maximum
  );
}
export function parseAuthResponse(value: unknown): AuthResponse {
  if (!isRecord(value) || !isRecord(value.user))
    throw new Error('Invalid auth response');
  const user = value.user;
  if (
    !validString(user.id, 100) ||
    !validString(user.email, 254) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) ||
    !validString(user.firstName, 100) ||
    !validString(user.lastName, 100) ||
    (user.role !== 'PLAYER' &&
      user.role !== 'ADMIN' &&
      user.role !== 'ORGANIZER') ||
    'accessToken' in value ||
    'refreshToken' in value ||
    'passwordHash' in user ||
    'googleId' in user
  )
    throw new Error('Invalid auth response');
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  };
}
export function parseCsrfResponse(value: unknown): CsrfResponse {
  if (
    !isRecord(value) ||
    typeof value.csrfToken !== 'string' ||
    !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(value.csrfToken)
  ) {
    throw new Error('Invalid CSRF response');
  }
  return { csrfToken: value.csrfToken };
}
export function parseApiError(value: unknown): ApiErrorResponse | undefined {
  if (
    !isRecord(value) ||
    !validString(value.error, 500) ||
    (value.code !== undefined && !validString(value.code, 100))
  )
    return undefined;
  return {
    error: value.error,
    ...(typeof value.code === 'string' ? { code: value.code } : {}),
  };
}
