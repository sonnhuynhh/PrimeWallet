import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'white';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ComponentProps<typeof motion.button> {
  title?: string;
  loading?: boolean;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[--color-primary] text-[--color-primary-foreground] hover:brightness-110 shadow-[0_12px_40px_-14px_var(--color-primary)]',
  secondary:
    'bg-[--color-surface-2] text-white border border-[--color-border] hover:bg-[--color-surface-3] hover:border-white/20',
  danger:
    'bg-[--color-destructive]/12 text-[--color-destructive] border border-[--color-destructive]/30 hover:bg-[--color-destructive]/20',
  ghost: 'text-[--color-muted-foreground] hover:bg-white/5 hover:text-white',
  outline:
    'border border-[--color-primary]/50 text-[--color-primary] hover:bg-[--color-primary-soft]',
  white: 'bg-white text-[#131313] hover:bg-white/90 shadow-[0_12px_40px_-18px_rgba(255,255,255,0.55)]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm rounded-full gap-1.5',
  md: 'h-11 px-6 text-sm rounded-full gap-2',
  lg: 'h-12 px-8 text-base rounded-full gap-2.5',
  icon: 'h-10 w-10 rounded-full',
};

export function Button({
  title,
  loading,
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: props.disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: props.disabled || loading ? 1 : 0.97 }}
      className={cn(
        'inline-flex items-center justify-center font-semibold tracking-tight transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-[--color-ring] focus-visible:ring-offset-2 focus-visible:ring-offset-[--color-background]',
        'disabled:opacity-45 disabled:cursor-not-allowed',
        size !== 'icon' && fullWidth && 'w-full',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <svg
          className="h-5 w-5 animate-spin text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        children ?? title
      )}
    </motion.button>
  );
}
