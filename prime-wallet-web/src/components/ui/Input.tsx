import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  hint?: React.ReactNode;
  error?: string | null;
  /** Nội dung dính bên phải ô nhập (VD nút MAX, ký hiệu token). */
  suffix?: React.ReactNode;
  /** Nội dung dính bên trái ô nhập (VD icon tìm kiếm). */
  prefix?: React.ReactNode;
  /** Class cho wrapper (bản cũ nhận className cho wrapper — giữ nguyên hành vi). */
  inputClassName?: string;
}

export function Input({
  label,
  hint,
  error,
  suffix,
  prefix,
  className = '',
  inputClassName = '',
  id,
  ...props
}: InputProps) {
  const autoId = React.useId();
  const inputId = id ?? autoId;

  return (
    <div className={cn('w-full flex flex-col gap-2', className)}>
      {label ? (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-[0.14em] text-[--color-muted-foreground]"
        >
          {label}
        </label>
      ) : null}

      <div
        className={cn(
          'group flex items-center gap-2 rounded-2xl border bg-[--color-surface-2]/90 transition-all',
          'focus-within:ring-2 focus-within:ring-[--color-ring]/35',
          error
            ? 'border-rose-500/70 focus-within:border-rose-500'
            : 'border-[--color-border] focus-within:border-[--color-primary]',
        )}
      >
        {prefix ? <span className="pl-4 text-[--color-muted-foreground]">{prefix}</span> : null}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cn(
            'w-full bg-transparent p-4 text-white outline-none placeholder:text-[--color-muted-foreground]/55',
            'disabled:cursor-not-allowed disabled:opacity-60',
            prefix && 'pl-2',
            suffix && 'pr-2',
            inputClassName,
          )}
          {...props}
        />
        {suffix ? <span className="shrink-0 pr-3">{suffix}</span> : null}
      </div>

      {error ? (
        <p className="text-xs text-rose-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[--color-muted-foreground]">{hint}</p>
      ) : null}
    </div>
  );
}
