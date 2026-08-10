import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Thanh tab kiểu tubelight Uniswap.
 * Mobile: chỉ icon + cuộn ngang; từ `sm` trở lên hiện thêm nhãn.
 */

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface TabBarProps<T extends string> {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId?: string;
  className?: string;
}

export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  layoutId = 'tabbar-pill',
  className,
}: TabBarProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  // Tab đang chọn luôn nằm trong vùng nhìn thấy khi đổi tab / đổi kích thước.
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>('[aria-selected="true"]');
    active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [value]);

  return (
    <div
      ref={listRef}
      role="tablist"
      className={cn(
        'flex w-full max-w-full gap-1 overflow-x-auto overscroll-x-contain rounded-full',
        'border border-[--color-border] bg-black/35 p-1.5 backdrop-blur-xl',
        'no-scrollbar touch-pan-x',
        className,
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.id === value;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={tab.label}
            title={tab.label}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex shrink-0 items-center justify-center gap-2 rounded-full',
              'px-3 py-2.5 text-sm font-semibold transition-colors sm:px-4',
              active ? 'text-white' : 'text-[--color-muted-foreground] hover:text-white/80',
            )}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-full bg-[--color-primary-soft] ring-1 ring-[--color-primary]/35"
              />
            ) : null}
            <Icon className="relative h-4 w-4" />
            <span className="relative hidden sm:inline">{tab.label}</span>
            {tab.badge ? (
              <span className="relative grid h-5 min-w-5 place-items-center rounded-full bg-[--color-primary] px-1.5 text-[10px] font-bold text-[--color-primary-foreground]">
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
