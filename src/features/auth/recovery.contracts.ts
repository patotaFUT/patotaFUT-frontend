import { isRecord } from './auth.contracts';
export interface RecoveryRequest {
  email: string;
}
export interface RecoveryCodeRequest {
  challengeId: string;
  code: string;
}
export interface ResetPasswordRequest {
  password: string;
}
export interface RecoveryChallengeResponse {
  message: string;
  challengeId: string;
  expiresIn: number;
  resendAfter: number;
}
export interface RecoveryVerifiedResponse {
  message: string;
  expiresIn: number;
}
export interface RecoveryCompleteResponse {
  message: string;
}
export type RecoveryStage = 'email' | 'code' | 'password' | 'complete';
export interface ResetFields {
  password: string;
  confirmPassword: string;
}
export type ResetFieldErrors = Partial<Record<keyof ResetFields, string>>;
function message(value: unknown): value is RecoveryCompleteResponse {
  return (
    isRecord(value) &&
    typeof value.message === 'string' &&
    value.message.length > 0 &&
    value.message.length <= 200 &&
    Object.keys(value).every((key) =>
      ['message', 'challengeId', 'expiresIn', 'resendAfter'].includes(key),
    )
  );
}
function seconds(value: unknown, maximum: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= maximum
  );
}
export function parseRecoveryChallenge(
  value: unknown,
): RecoveryChallengeResponse {
  if (
    !isRecord(value) ||
    !message(value) ||
    typeof value.challengeId !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.challengeId) ||
    !seconds(value.expiresIn, 600) ||
    !seconds(value.resendAfter, 600)
  )
    throw new Error('Invalid recovery response');
  return {
    message: value.message,
    challengeId: value.challengeId,
    expiresIn: value.expiresIn,
    resendAfter: value.resendAfter,
  };
}
export function parseRecoveryVerified(
  value: unknown,
): RecoveryVerifiedResponse {
  if (!isRecord(value) || !message(value) || !seconds(value.expiresIn, 300))
    throw new Error('Invalid recovery response');
  return { message: value.message, expiresIn: value.expiresIn };
}
export function parseRecoveryComplete(
  value: unknown,
): RecoveryCompleteResponse {
  if (!message(value) || Object.keys(value).length !== 1)
    throw new Error('Invalid recovery response');
  return { message: value.message };
}
