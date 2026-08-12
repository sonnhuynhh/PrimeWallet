import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TokenIcon } from '@/components/ui/TokenIcon';

export type TokenPickerItem = {
  address: string;
  symbol: string;
};

type Props<T extends TokenPickerItem> = {
  tokens: readonly T[];
  value: T;
  onChange: (token: T) => void;
  className?: string;
};

/** Chọn token có icon — thay native &lt;select&gt; (không render icon trong option). */
export function TokenPicker<T extends TokenPickerItem>({ tokens, value, onChange, className }: Props<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative shrink-0', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex items-center gap-2 rounded-xl border border-[--color-border] bg-slate-900 py-2 pl-2 pr-3',
          'font-bold text-white transition-colors hover:border-[--color-primary]/50',
          open && 'border-[--color-primary]/60',
        )}
      >
        <TokenIcon symbol={value.symbol} size={28} />
        <span>{value.symbol}</span>
        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <ul
          className="absolute right-0 z-50 mt-2 min-w-[10rem] overflow-hidden rounded-xl border border-[--color-border] bg-slate-900 py-1 shadow-xl"
          role="listbox"
        >
          {tokens.map((token) => {
            const selected = token.address === value.address;
            return (
              <li key={token.address} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(token);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-semibold transition-colors',
                    selected
                      ? 'bg-[--color-primary-soft] text-[--color-primary]'
                      : 'text-white hover:bg-white/5',
                  )}
                >
                  <TokenIcon symbol={token.symbol} size={24} />
                  <span>{token.symbol}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
