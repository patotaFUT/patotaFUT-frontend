'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { FiUser, FiMail, FiLock } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { Button } from '@/components/ui/button';
import { authPaths } from '@/config/public';
import { authContent } from '../auth.content';
import type {
  RegisterFields,
  RegisterFieldErrors,
  RegisterRequest,
} from '../auth.contracts';
import { validateRegister, toRegisterRequest } from '../auth.validation';
import { AuthField } from './auth-field';
import styles from './auth-form.module.css';

interface RegisterFormProps {
  authenticated: boolean;
  disabled: boolean;
  loading: boolean;
  onRegister: (input: RegisterRequest) => Promise<void>;
}

interface RegisterControl {
  name: keyof RegisterFields;
  label: string;
  placeholder: string;
  type: 'text' | 'email' | 'password';
  autoComplete: 'given-name' | 'family-name' | 'email' | 'new-password';
  icon: IconType;
}
const controls: ReadonlyArray<RegisterControl> = [
  {
    name: 'firstName',
    label: authContent.firstName,
    placeholder: authContent.firstNamePlaceholder,
    type: 'text',
    autoComplete: 'given-name',
    icon: FiUser,
  },
  {
    name: 'lastName',
    label: authContent.lastName,
    placeholder: authContent.lastNamePlaceholder,
    type: 'text',
    autoComplete: 'family-name',
    icon: FiUser,
  },
  {
    name: 'email',
    label: authContent.email,
    placeholder: authContent.emailPlaceholder,
    type: 'email',
    autoComplete: 'email',
    icon: FiMail,
  },
  {
    name: 'password',
    label: authContent.password,
    placeholder: authContent.passwordPlaceholder,
    type: 'password',
    autoComplete: 'new-password',
    icon: FiLock,
  },
  {
    name: 'confirmPassword',
    label: authContent.confirmPassword,
    placeholder: authContent.confirmPasswordPlaceholder,
    type: 'password',
    autoComplete: 'new-password',
    icon: FiLock,
  },
];

export function RegisterForm({
  authenticated,
  disabled,
  loading,
  onRegister,
}: RegisterFormProps) {
  const [fields, setFields] = useState<RegisterFields>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<RegisterFieldErrors>({});
  const inputs = useRef<
    Partial<Record<keyof RegisterFields, HTMLInputElement | null>>
  >({});
  // Preserve useful text after failures, but discard both passwords on confirmed authentication.
  useEffect(() => {
    if (authenticated)
      setFields((current) => ({
        ...current,
        password: '',
        confirmPassword: '',
      }));
  }, [authenticated]);

  function change(name: keyof RegisterFields, value: string): void {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      if (name === 'password') delete next.confirmPassword;
      return next;
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (disabled) return;
    const invalid = validateRegister(fields);
    setErrors(invalid);
    for (const field of controls) {
      if (invalid[field.name] !== undefined) {
        inputs.current[field.name]?.focus();
        return;
      }
    }
    await onRegister(toRegisterRequest(fields));
  }

  if (authenticated) return null;
  return (
    <>
      <p className={styles.navigation}>
        {authContent.existingAccount}{' '}
        <Link className={styles.link} href={authPaths.login}>
          {authContent.enter}
        </Link>
      </p>
      <form
        className={styles.form}
        noValidate
        aria-busy={loading}
        onSubmit={(event) => void submit(event)}
      >
        {controls.map((field) => (
          <AuthField
            key={field.name}
            id={`register-${field.name}`}
            name={field.name}
            label={field.label}
            placeholder={field.placeholder}
            type={field.type}
            autoComplete={field.autoComplete}
            icon={field.icon}
            value={fields[field.name]}
            onChange={(value) => change(field.name, value)}
            disabled={disabled}
            error={errors[field.name]}
            inputRef={(element) => {
              inputs.current[field.name] = element;
            }}
            confirmation={field.name === 'confirmPassword'}
            {...(field.name === 'password'
              ? { hint: authContent.passwordHint }
              : {})}
          />
        ))}
        <Button type="submit" disabled={disabled}>
          {loading ? authContent.creatingAccount : authContent.createAccount}
        </Button>
      </form>
    </>
  );
}
