import type { ButtonHTMLAttributes } from 'react';
import styles from './button.module.css';
export function Button({
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      type={type}
      className={[styles.primary, className].filter(Boolean).join(' ')}
    />
  );
}
