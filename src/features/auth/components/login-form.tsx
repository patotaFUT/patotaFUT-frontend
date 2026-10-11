'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { FiLock, FiMail } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { authPaths } from '@/config/public';
import { authContent } from '../auth.content';
import { validateLogin } from '../auth.validation';
import type { FieldErrors, LoginFields, LoginRequest } from '../auth.contracts';
import { AuthField } from './auth-field';
import styles from './auth-form.module.css';

interface LoginFormProps {
  authenticated: boolean;
  disabled: boolean;
  loading: boolean;
  onLogin: (input: LoginRequest) => Promise<void>;
}
export function LoginForm({
  authenticated,
  disabled,
  loading,
  onLogin,
}: LoginFormProps) {
  const [fields, setFields] = useState<LoginFields>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (authenticated) setFields((current) => ({ ...current, password: '' }));
  }, [authenticated]);
  function change(name: keyof LoginFields, value: string): void {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (disabled) return;
    const invalid = validateLogin(fields);
    setErrors(invalid);
    if (invalid.email !== undefined) {
      emailInput.current?.focus();
      return;
    }
    if (invalid.password !== undefined) {
      passwordInput.current?.focus();
      return;
    }
    await onLogin({ email: fields.email, password: fields.password });
  }
  if (authenticated) return null;
  return (
    <>
      <p className={styles.navigation}>
        {authContent.accountQuestion}{' '}
        <Link className={styles.link} href={authPaths.register}>
          {authContent.register}
        </Link>
      </p>
      <form
        className={[styles.form, styles.loginForm].join(' ')}
        noValidate
        aria-busy={loading}
        onSubmit={(event) => void submit(event)}
      >
        <AuthField
          id="email"
          name="email"
          label={authContent.email}
          placeholder={authContent.emailPlaceholder}
          type="email"
          autoComplete="username"
          icon={FiMail}
          value={fields.email}
          disabled={disabled}
          error={errors.email}
          inputRef={emailInput}
          onChange={(value) => change('email', value)}
        />
        <AuthField
          id="password"
          name="password"
          label={authContent.password}
          placeholder={authContent.passwordPlaceholder}
          type="password"
          autoComplete="current-password"
          icon={FiLock}
          value={fields.password}
          disabled={disabled}
          error={errors.password}
          inputRef={passwordInput}
          onChange={(value) => change('password', value)}
        />
        <div className={styles.forgotReference}>
          <Link className={styles.link} href={authPaths.recovery}>
            {authContent.forgotPassword}
          </Link>
        </div>
        <Button
          type="submit"
          className={styles.loginSubmit}
          disabled={disabled}
        >
          {loading ? authContent.entering : authContent.enter}
        </Button>
      </form>
    </>
  );
}
