import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BorderBeam } from '@/components/effects/BorderBeam';

interface CardProps extends React.ComponentProps<typeof motion.div> {
  children: React.ReactNode;
  bare?: boolean;
  interactive?: boolean;
  /** Magic UI border beam quanh card. */
  beam?: boolean;
}

export function Card({
  children,
  className = '',
  bare,
  interactive,
  beam,
  ...props
}: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative overflow-hidden rounded-3xl border border-[--color-border] bg-[--color-card] shadow-[0_24px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl',
        !bare && 'p-6',
        interactive &&
          'cursor-pointer transition-colors hover:border-[--color-primary]/45 hover:bg-white/[0.04]',
        className,
      )}
      {...props}
    >
      {beam ? <BorderBeam /> : null}
      {children}
    </motion.div>
  );
}

export function CardHeader({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex items-start justify-between gap-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[--color-primary-soft] text-[--color-primary]">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-bold tracking-tight text-white">
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-sm text-[--color-muted-foreground]">{description}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}
