'use client';

import React, { forwardRef } from 'react';
import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:    string;
  error?:    string;
  iconRight?: React.ReactNode;
  onIconRightClick?: () => void;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, iconRight, onIconRightClick, className = '', id, ...rest },
  ref
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <div className={styles.wrapper}>
        <input
          ref={ref}
          id={inputId}
          className={[
            styles.input,
            iconRight ? styles['input--with-icon'] : '',
            error     ? styles['input--error'] : '',
            className,
          ].filter(Boolean).join(' ')}
          {...rest}
        />
        {iconRight && (
          <button
            type="button"
            className={styles['icon-right']}
            onClick={onIconRightClick}
            tabIndex={-1}
            aria-label="Toggle input"
          >
            {iconRight}
          </button>
        )}
      </div>
      {error && <span className={styles['error-msg']} role="alert">{error}</span>}
    </div>
  );
});

export default Input;
