import { cn } from '@/lib/utils';

/**
 * Nền "aurora": 3 khối gradient mờ chồng nhau, trôi chậm bằng CSS keyframes.
 *
 * Dùng CSS thuần thay vì canvas/WebGL để không tốn thêm bundle và tự tắt
 * khi người dùng bật `prefers-reduced-motion` (xử lý ở index.css).
 */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute -left-1/4 -top-1/3 h-[70vh] w-[70vw] rounded-full bg-[#fc72ff]/20 blur-[120px] animate-aurora" />
      <div
        className="absolute -right-1/4 top-0 h-[60vh] w-[55vw] rounded-full bg-[#4c82fb]/18 blur-[120px] animate-aurora"
        style={{ animationDelay: '-7s' }}
      />
      <div
        className="absolute -bottom-1/4 left-1/4 h-[55vh] w-[60vw] rounded-full bg-[#b478ff]/16 blur-[120px] animate-aurora"
        style={{ animationDelay: '-14s' }}
      />
      {/* Lưới mờ tạo cảm giác "mặt phẳng kỹ thuật" phía sau nội dung */}
      <div
        className="absolute inset-0 opacity-[0.1]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at 50% 0%, black 35%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, black 35%, transparent 78%)',
        }}
      />
    </div>
  );
}
