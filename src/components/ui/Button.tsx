'use client';

import React from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'dark' | 'ghost';
type ButtonSize    = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  fullWidth?: boolean;
  loading?:  boolean;
  children:  React.ReactNode;
}

export default function Button({
  variant  = 'primary',
  size     = 'md',
  fullWidth = false,
  loading   = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.btn,
    styles[`btn--${variant}`],
    styles[`btn--${size}`],
    fullWidth ? styles['btn--full'] : '',
    loading   ? styles['btn--loading'] : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && <span className={styles.btn__spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}
