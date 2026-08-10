import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';

/**
 * Icon từ Iconify / [icons0.dev](https://icons0.dev/) — mặc định bộ Lucide,
 * token dùng `cryptocurrency-color:*` qua TokenIcon.
 */
export function AppIcon({
  name,
  className,
  size = 20,
}: {
  /** Tên icon, ví dụ `lucide:wallet` hoặc `solar:shield-check-bold`. */
  name: string;
  className?: string;
  size?: number;
}) {
  return (
    <Icon
      icon={name}
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      aria-hidden
    />
  );
}
