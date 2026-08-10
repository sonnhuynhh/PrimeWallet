import React from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Thẻ nghiêng 3D theo con trỏ.
 *
 * Con trỏ → toạ độ chuẩn hoá [-0.5, 0.5] → góc xoay, đi qua spring nên
 * chuyển động có quán tính thay vì bám dính chuột.
 * Không có con trỏ (mobile) thì thẻ đứng yên — không cần fallback riêng.
 */
export function TiltCard({
  children,
  className,
  maxTilt = 12,
}: {
  children: React.ReactNode;
  className?: string;
  /** Góc nghiêng tối đa (độ). */
  maxTilt?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springCfg = { stiffness: 220, damping: 22, mass: 0.6 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [maxTilt, -maxTilt]), springCfg);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-maxTilt, maxTilt]), springCfg);

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div style={{ perspective: 1200 }} className={cn('relative', className)}>
      <motion.div
        ref={ref}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}
