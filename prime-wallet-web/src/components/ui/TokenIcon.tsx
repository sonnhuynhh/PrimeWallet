import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';

/**
 * Icon token/coin màu từ bộ `cryptocurrency-color` (Iconify — icons0.dev).
 * Không có icon cho symbol → avatar chữ cái với gradient theo accent.
 */

/** Symbol hiển thị → tên icon trong bộ cryptocurrency-color. */
const SYMBOL_TO_ICON: Record<string, string> = {
  eth: 'eth',
  weth: 'eth',
  bnb: 'bnb',
  tbnb: 'bnb',
  pol: 'matic',
  matic: 'matic',
  usdt: 'usdt',
  usdc: 'usdc',
  dai: 'dai',
  uni: 'uni',
  link: 'link',
  wbtc: 'wbtc',
  btc: 'btc',
  arb: 'arb',
  op: 'op',
};

interface TokenIconProps {
  symbol: string;
  /** Kích thước px — mặc định 36. */
  size?: number;
  className?: string;
}

export function TokenIcon({ symbol, size = 36, className }: TokenIconProps) {
  const key = symbol?.trim().toLowerCase() ?? '';
  const iconName = SYMBOL_TO_ICON[key] ?? (key.length <= 5 ? key : undefined);

  if (iconName) {
    return (
      <span
        className={cn(
          'grid shrink-0 place-items-center overflow-hidden rounded-full bg-[--color-surface-2]',
          className,
        )}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <Icon
          icon={`cryptocurrency-color:${iconName}`}
          width={size}
          height={size}
          // Iconify tự fallback về render rỗng khi icon không tồn tại;
          // avatar chữ bên dưới chỉ dùng khi biết chắc không có icon.
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-black text-white',
        'bg-[linear-gradient(135deg,#fc72ff,#4c82fb)]',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {symbol?.slice(0, 2).toUpperCase()}
    </span>
  );
}
