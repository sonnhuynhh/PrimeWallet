import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-white/10 text-slate-200',
        success: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20',
        warning: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20',
        danger: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/20',
        primary: 'bg-[--color-primary-soft] text-[--color-primary] ring-1 ring-[--color-primary]/20',
        outline: 'border border-[--color-border] text-slate-300',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Chấm tròn bên trái — màu tự động theo variant. */
  dot?: boolean;
}

export function Badge({ variant, dot, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
