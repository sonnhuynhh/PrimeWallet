import { cn } from '@/lib/utils';

/**
 * Chấm sáng chạy quanh viền card (kiểu Magic UI BorderBeam) — thuần CSS
 * offset-path nên không tốn JS. Đặt bên trong phần tử `relative` có bo góc.
 */
export function BorderBeam({
  className,
  duration = 7,
  size = 90,
}: {
  className?: string;
  /** Giây cho một vòng chạy. */
  duration?: number;
  /** Chiều dài vệt sáng (px). */
  size?: number;
}) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 rounded-[inherit]', className)}
      style={{
        border: '1px solid transparent',
        maskImage: 'linear-gradient(transparent, transparent), linear-gradient(#000, #000)',
        maskClip: 'padding-box, border-box',
        maskComposite: 'intersect',
      }}
    >
      <div
        className="absolute animate-border-beam"
        style={{
          width: size,
          height: size,
          offsetPath: 'rect(0 auto auto 0 round 24px)',
          background:
            'linear-gradient(90deg, transparent, #fc72ff, #4c82fb, transparent)',
          animationDuration: `${duration}s`,
        }}
      />
    </div>
  );
}
