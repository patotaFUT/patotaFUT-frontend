import Image from 'next/image';
import type { ReactNode } from 'react';
import { brandPresentation } from '@/config/public';
import { authContent } from '../auth.content';
import styles from './auth-layout.module.css';

export function AuthLayout({
  title,
  children,
  variant = 'default',
}: {
  title: string;
  children: ReactNode;
  variant?: 'default' | 'login';
}) {
  return (
    <main
      className={[
        styles.loginPage,
        variant === 'login' ? styles.loginReference : '',
      ].join(' ')}
      tabIndex={0}
      aria-labelledby="auth-title"
    >
      <section className={styles.loginContent} aria-labelledby="auth-title">
        <header className={styles.loginHeading}>
          <Image
            className={styles.brandLogo}
            src={brandPresentation.logoPath}
            alt={authContent.logo}
            width={brandPresentation.width}
            height={brandPresentation.height}
            priority
          />
          <h1 id="auth-title">{title}</h1>
        </header>
        {children}
      </section>
    </main>
  );
}
