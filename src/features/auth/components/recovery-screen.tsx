'use client';
import { GlobalAccessLoading } from '@/features/auth/components/global-access-loading';
import Link from 'next/link';
import { useAuth } from '../use-auth';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { FiCheckCircle, FiHash, FiLock, FiMail } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { authPaths } from '@/config/public';
import { authContent, recoveryContent as content } from '../auth.content';
import { authClient } from '../browser-client';
import { safeFailure } from '../auth.service';
import { validateRecoveryEmail, validateReset } from '../auth.validation';
import type {
  RecoveryChallengeResponse,
  RecoveryStage,
  ResetFields,
  ResetFieldErrors,
} from '../recovery.contracts';
import { AuthLayout } from './auth-layout';
import { AuthField } from './auth-field';
import formStyles from './auth-form.module.css';
import styles from './recovery-screen.module.css';

export function RecoveryScreen() {
  const auth = useAuth();
  const [stage, setStage] = useState<RecoveryStage>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [fields, setFields] = useState<ResetFields>({
    password: '',
    confirmPassword: '',
  });
  const [challenge, setChallenge] = useState<RecoveryChallengeResponse>();
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState<'idle' | 'submit' | 'resend'>('idle');
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const [failure, setFailure] = useState<string>();
  const [emailError, setEmailError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const [errors, setErrors] = useState<ResetFieldErrors>({});
  const firstInput = useRef<HTMLInputElement>(null);
  const confirmationInput = useRef<HTMLInputElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const disabled = busy !== 'idle';
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (stage === 'complete') status.current?.focus();
    else firstInput.current?.focus();
  }, [stage]);
  useEffect(() => {
    const update = (): void =>
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  async function operate(resend = false): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(resend ? 'resend' : 'submit');
    setFailure(undefined);
    try {
      if (stage === 'email' || resend) {
        const result = await authClient.requestRecovery(email, resend);
        if (!mounted.current) return;
        setChallenge(result);
        setDeadline(Date.now() + result.resendAfter * 1000);
        setRemaining(result.resendAfter);
        setCode('');
        setCodeError(undefined);
        setStage('code');
      } else if (stage === 'code' && challenge !== undefined) {
        await authClient.verifyRecovery({
          challengeId: challenge.challengeId,
          code,
        });
        if (!mounted.current) return;
        setCode('');
        setStage('password');
      } else if (stage === 'password') {
        await authClient.resetPassword({ password: fields.password });
        if (!mounted.current) return;
        setFields({ password: '', confirmPassword: '' });
        setChallenge(undefined);
        setStage('complete');
      }
    } catch (error: unknown) {
      if (mounted.current) setFailure(safeFailure(error).message);
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy('idle');
    }
  }
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (disabled || busyRef.current) return;
    if (stage === 'email') {
      const invalid = validateRecoveryEmail(email);
      setEmailError(invalid);
      if (invalid !== undefined) {
        firstInput.current?.focus();
        return;
      }
    } else if (stage === 'code' && !/^\d{8}$/.test(code)) {
      setCodeError(content.codeInvalid);
      firstInput.current?.focus();
      return;
    } else if (stage === 'password') {
      const invalid = validateReset(fields);
      setErrors(invalid);
      if (invalid.password !== undefined) {
        firstInput.current?.focus();
        return;
      }
      if (invalid.confirmPassword !== undefined) {
        confirmationInput.current?.focus();
        return;
      }
    }
    void operate();
  }
  function restart(): void {
    if (disabled) return;
    setStage('email');
    setChallenge(undefined);
    setCode('');
    setCodeError(undefined);
    setFields({ password: '', confirmPassword: '' });
    setErrors({});
    setFailure(undefined);
  }
  const title =
    stage === 'email'
      ? content.emailTitle
      : stage === 'code'
        ? content.codeTitle
        : stage === 'password'
          ? content.passwordTitle
          : content.completeTitle;
  const label =
    stage === 'email'
      ? disabled
        ? content.requesting
        : content.request
      : stage === 'code'
        ? disabled
          ? content.verifying
          : content.verify
        : disabled
          ? content.resetting
          : content.reset;
  return (
    <AuthLayout title={title}>
      <GlobalAccessLoading
        session={auth.session}
        onRetry={() => void auth.restore()}
      />
      {failure !== undefined && (
        <p className={styles.error} role="alert">
          {failure}
        </p>
      )}
      {stage === 'complete' ? (
        <div
          className={styles.success}
          role="status"
          tabIndex={-1}
          ref={status}
        >
          <FiCheckCircle aria-hidden="true" />
          <p>{content.complete}</p>
          <Link className={styles.link} href={authPaths.login}>
            {authContent.enter}
          </Link>
        </div>
      ) : (
        <>
          <p
            className={styles.description}
            role={stage === 'code' ? 'status' : undefined}
          >
            {stage === 'email'
              ? content.introduction
              : stage === 'code'
                ? content.generic
                : content.passwordHelp}
          </p>
          {stage === 'code' && (
            <p className={styles.description}>{content.codeHelp}</p>
          )}
          <form
            className={formStyles.form}
            noValidate
            aria-busy={disabled}
            onSubmit={submit}
          >
            {stage === 'email' && (
              <AuthField
                id="recovery-email"
                name="email"
                label={authContent.email}
                placeholder={authContent.emailPlaceholder}
                type="email"
                autoComplete="email"
                icon={FiMail}
                value={email}
                disabled={disabled}
                error={emailError}
                inputRef={firstInput}
                onChange={(value) => {
                  setEmail(value);
                  setEmailError(undefined);
                }}
              />
            )}
            {stage === 'code' && (
              <AuthField
                id="recovery-code"
                name="code"
                label={content.code}
                placeholder={content.codePlaceholder}
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={8}
                icon={FiHash}
                value={code}
                disabled={disabled}
                error={codeError}
                inputRef={firstInput}
                onChange={(value) => {
                  setCode(value);
                  setCodeError(undefined);
                }}
              />
            )}
            {stage === 'password' && (
              <>
                <AuthField
                  id="new-password"
                  name="password"
                  label={content.newPassword}
                  placeholder={content.newPasswordPlaceholder}
                  type="password"
                  autoComplete="new-password"
                  icon={FiLock}
                  value={fields.password}
                  disabled={disabled}
                  error={errors.password}
                  hint={authContent.passwordHint}
                  inputRef={firstInput}
                  onChange={(value) => {
                    setFields((current) => ({ ...current, password: value }));
                    setErrors({});
                  }}
                />
                <AuthField
                  id="confirm-password"
                  name="confirmPassword"
                  label={authContent.confirmPassword}
                  placeholder={authContent.confirmPasswordPlaceholder}
                  type="password"
                  autoComplete="new-password"
                  icon={FiLock}
                  value={fields.confirmPassword}
                  disabled={disabled}
                  confirmation
                  error={errors.confirmPassword}
                  inputRef={confirmationInput}
                  onChange={(value) => {
                    setFields((current) => ({
                      ...current,
                      confirmPassword: value,
                    }));
                    setErrors({});
                  }}
                />
              </>
            )}
            <Button type="submit" disabled={disabled}>
              {label}
            </Button>
          </form>
          <div className={styles.actions}>
            {stage === 'code' && (
              <button
                className={styles.secondary}
                type="button"
                disabled={disabled || remaining > 0}
                onClick={() => void operate(true)}
              >
                {busy === 'resend'
                  ? content.resending
                  : remaining > 0
                    ? `${content.resendCountdown} ${remaining}${content.seconds}`
                    : content.resend}
              </button>
            )}
            {stage !== 'email' && (
              <button
                className={styles.secondary}
                type="button"
                disabled={disabled}
                onClick={restart}
              >
                {content.restart}
              </button>
            )}
            <Link className={styles.link} href={authPaths.login}>
              {content.back}
            </Link>
          </div>
        </>
      )}
    </AuthLayout>
  );
}
