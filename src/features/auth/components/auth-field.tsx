'use client';

import { useState } from 'react';
import type { Ref } from 'react';
import type { IconType } from 'react-icons';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { authContent } from '../auth.content';
import styles from './auth-field.module.css';

interface AuthFieldProps {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  type: 'text' | 'email' | 'password';
  autoComplete:
    | 'given-name'
    | 'family-name'
    | 'email'
    | 'username'
    | 'new-password'
    | 'current-password'
    | 'one-time-code';
  inputMode?: 'numeric';
  maxLength?: number;
  value: string;
  disabled: boolean;
  error: string | undefined;
  inputRef: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
  icon: IconType;
  hint?: string;
  confirmation?: boolean;
}

export function AuthField({
  id,
  name,
  label,
  placeholder,
  type,
  autoComplete,
  value,
  disabled,
  error,
  inputRef,
  onChange,
  icon: Icon,
  hint,
  confirmation = false,
  inputMode,
  maxLength,
}: AuthFieldProps) {
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const description =
    [
      error === undefined ? undefined : errorId,
      hint === undefined ? undefined : hintId,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  const toggleLabel = confirmation
    ? visible
      ? authContent.hideConfirmation
      : authContent.showConfirmation
    : visible
      ? authContent.hidePassword
      : authContent.showPassword;

  return (
    <div className={styles.fieldGroup}>
      <label className="visually-hidden" htmlFor={id}>
        {label}
      </label>
      <div className={styles.inputShell} data-invalid={error !== undefined}>
        <Icon className={styles.fieldIcon} aria-hidden="true" />
        <input
          ref={inputRef}
          id={id}
          name={name}
          type={password && visible ? 'text' : type}
          autoComplete={autoComplete}
          inputMode={inputMode ?? (type === 'email' ? 'email' : undefined)}
          maxLength={maxLength}
          autoCapitalize={type === 'email' ? 'none' : undefined}
          spellCheck={false}
          required
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          aria-invalid={error !== undefined}
          aria-describedby={description}
          onChange={(event) => onChange(event.target.value)}
        />
        {password && (
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setVisible(!visible)}
            disabled={disabled}
            aria-label={toggleLabel}
            aria-pressed={visible}
          >
            {visible ? (
              <FiEyeOff aria-hidden="true" />
            ) : (
              <FiEye aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {hint !== undefined && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p className={styles.fieldError} id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
