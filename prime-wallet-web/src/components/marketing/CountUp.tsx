import React from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

/**
 * Số đếm lên khi cuộn tới. Chỉ chạy một lần (`once: true`) để không nhảy số
 * mỗi lần người dùng cuộn qua lại.
 */
export function CountUp({
  to,
  suffix = '',
  prefix = '',
  decimals = 0,
  className,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  const value = useMotionValue(0);
  const spring = useSpring(value, { stiffness: 60, damping: 18 });
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    if (inView) value.set(to);
  }, [inView, to, value]);

  React.useEffect(() => spring.on('change', (v) => setDisplay(v)), [spring]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString('vi-VN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
