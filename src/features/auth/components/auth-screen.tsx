'use client';

import { FiCheckCircle, FiLogOut } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { authContent, roleLabels } from '../auth.content';
import { AuthLayout } from './auth-layout';
import { useAuth } from '../use-auth';
import { GoogleButton } from './google-button';
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';
import styles from './auth-screen.module.css';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AuthScreen({ mode }: { mode: 'login' | 'register' }) {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.session.status === 'authenticated') router.replace('/events');
  }, [auth.session.status, router]);
  const disabled =
    auth.operation !== 'idle' || auth.session.status === 'checking';
  const sessionError =
    auth.session.status === 'error' ? auth.session.error : undefined;
  const failure = auth.error ?? sessionError;

  return (
    <AuthLayout
      variant={mode === 'login' ? 'login' : 'default'}
      title={
        mode === 'register' ? authContent.registerTitle : authContent.title
      }
    >
      {auth.session.status === 'checking' && (
        <p className={styles.notice} role="status">
          {authContent.checking}
        </p>
      )}
      {failure !== undefined && (
        <div
          className={[styles.notice, styles.noticeError].join(' ')}
          role="alert"
        >
          <p>{failure.message}</p>
          {sessionError !== undefined && (
            <button
              type="button"
              className={styles.textButton}
              disabled={disabled}
              onClick={() => void auth.restore()}
            >
              {authContent.retry}
            </button>
          )}
        </div>
      )}
      {mode === 'register' ? (
        <RegisterForm
          authenticated={auth.session.status === 'authenticated'}
          disabled={disabled}
          loading={auth.operation === 'register'}
          onRegister={auth.register}
        />
      ) : (
        <LoginForm
          authenticated={auth.session.status === 'authenticated'}
          disabled={disabled}
          loading={auth.operation === 'local'}
          onLogin={auth.login}
        />
      )}
      {auth.session.status === 'authenticated' ? (
        <div className={styles.sessionPanel}>
          <p className={styles.sessionConfirmation} role="status">
            <FiCheckCircle aria-hidden="true" />
            {auth.success
              ? mode === 'register'
                ? authContent.registered
                : authContent.authenticated
              : authContent.restored}
          </p>
          <p className={styles.sessionName}>
            {auth.session.user.firstName} {auth.session.user.lastName}
          </p>
          <p className={styles.sessionEmail}>{auth.session.user.email}</p>
          <p className={styles.sessionRole}>
            {authContent.roleLabel}: {roleLabels[auth.session.user.role]}
          </p>
          <Button
            type="button"
            className={styles.logoutButton}
            disabled={disabled}
            onClick={() => void auth.logout()}
          >
            <FiLogOut aria-hidden="true" />
            {auth.operation === 'logout'
              ? authContent.signingOut
              : authContent.signOut}
          </Button>
        </div>
      ) : mode === 'login' ? (
        <>
          <div className={styles.authSeparator}>
            <span>{authContent.separator}</span>
          </div>
          <GoogleButton disabled={disabled} onCredential={auth.google} />
        </>
      ) : null}
    </AuthLayout>
  );
}
