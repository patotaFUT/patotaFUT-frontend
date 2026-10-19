import type { ButtonHTMLAttributes } from 'react';
import styles from './button.module.css';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger';
  iconOnly?: boolean;
}
export function Button({
  className,
  type = 'button',
  variant = 'primary',
  iconOnly = false,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={[
        styles.button,
        styles[variant],
        iconOnly ? styles.icon : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
