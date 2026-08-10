import { cn } from '@/lib/utils';

/** Khối giữ chỗ khi đang tải — shimmer chạy ngang. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'rounded-lg bg-white/5 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.08)_50%,transparent_100%)]',
        'bg-[length:200%_100%] animate-shimmer',
        className,
      )}
    />
  );
}

/** Nhiều dòng chữ giả — dùng cho danh sách/bảng đang tải. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** Hàng danh sách giả: avatar tròn + 2 dòng + số bên phải. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 py-3', className)}>
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-3xl border border-[--color-border] bg-[--color-card] p-6', className)}>
      <Skeleton className="h-5 w-32" />
      <Skeleton className="mt-4 h-9 w-48" />
      <SkeletonText lines={2} className="mt-5" />
    </div>
  );
}

/** Màn chờ toàn trang — dùng khi router chưa biết đẩy người dùng đi đâu. */
export function FullPageSpinner({ label = 'Đang tải...' }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[--color-background]">
      <div className="flex flex-col items-center gap-4">
        <span className="h-9 w-9 animate-spin rounded-full border-2 border-[--color-surface-3] border-t-[--color-primary]" />
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}
