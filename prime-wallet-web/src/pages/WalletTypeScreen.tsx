import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { WebGLBackground } from '@/components/effects/WebGLBackground';
import { BorderBeam } from '@/components/effects/BorderBeam';
import { useAnimeReveal } from '@/components/effects/useAnimeReveal';
import { Badge } from '@/components/ui/Badge';
import { AppIcon } from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

type Mode = 'fiat' | 'crypto';

const OPTIONS: {
  mode: Mode;
  icon: string;
  title: string;
  suffix: string;
  description: string;
  points: { icon: string; label: string }[];
  badge: string;
}[] = [
  {
    mode: 'fiat',
    icon: 'lucide:landmark',
    title: 'Ví Fiat',
    suffix: 'VND',
    description:
      'Tiền Việt Nam đồng. Tài khoản số, nạp tiền qua VNPAY, chuyển tiền và thanh toán hóa đơn.',
    points: [
      { icon: 'lucide:credit-card', label: 'Nạp tiền qua cổng VNPAY thật' },
      { icon: 'lucide:arrow-left-right', label: 'Chuyển / nhận tiền VND tức thì' },
      { icon: 'lucide:receipt', label: 'Thanh toán hóa đơn, lịch sử đầy đủ' },
    ],
    badge: 'Cổng thanh toán thật',
  },
  {
    mode: 'crypto',
    icon: 'cryptocurrency-color:eth',
    title: 'Ví Crypto',
    suffix: 'Web3',
    description:
      'Ví non-custodial trên 5 mạng. Swap, NFT, quản lý hạn mức — khoá riêng tư không rời trình duyệt.',
    points: [
      { icon: 'lucide:globe', label: 'Ethereum, BSC, Polygon, Base, Sepolia' },
      { icon: 'lucide:repeat', label: 'Swap tự định tuyến qua Uniswap V3' },
      { icon: 'lucide:key-round', label: 'Seed phrase chỉ tồn tại trong phiên' },
    ],
    badge: 'Non-custodial',
  },
];

export function WalletTypeScreen() {
  const { session, signOut, setActiveWalletMode } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState<Mode | null>(null);
  const reveal = useAnimeReveal('[data-reveal]');

  const choose = (mode: Mode) => {
    setSwitching(mode);
    setActiveWalletMode(mode);
    setTimeout(() => navigate(mode === 'fiat' ? '/fiat' : '/crypto'), 220);
  };

  const firstName = session?.profile.fullName.split(' ').slice(-1)[0] ?? '';

  return (
    <div className="noise-overlay relative flex min-h-screen flex-col overflow-hidden bg-[--color-background] text-[--color-foreground]">
      <WebGLBackground className="opacity-55" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-white">
          Prime<span className="text-gradient-uni">Wallet</span>
        </h1>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-bold text-white">{session?.profile.fullName}</p>
            <p className="text-xs text-[--color-muted-foreground]">{session?.profile.email}</p>
          </div>

          {session?.auth?.role === 'ADMIN' ? (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-400 transition-colors hover:bg-rose-500/20"
            >
              <AppIcon name="lucide:shield-alert" size={16} /> Quản trị
            </button>
          ) : null}

          <button
            type="button"
            onClick={signOut}
            className="rounded-full p-2.5 text-rose-400 transition-colors hover:bg-rose-500/10"
            title="Đăng xuất"
          >
            <AppIcon name="lucide:log-out" size={18} />
          </button>
        </div>
      </header>

      <main
        ref={reveal}
        className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-6 py-12"
      >
        <div className="mb-12 text-center">
          <p
            data-reveal
            className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-[--color-muted-foreground]"
            style={{ opacity: 0 }}
          >
            Chào mừng trở lại{firstName ? `, ${firstName}` : ''}
          </p>
          <h2
            data-reveal
            className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl"
            style={{ opacity: 0 }}
          >
            Chọn loại ví bạn muốn dùng
          </h2>
          <p
            data-reveal
            className="mx-auto mt-4 max-w-xl text-[--color-muted-foreground]"
            style={{ opacity: 0 }}
          >
            Mỗi loại ví có bộ tính năng và giao diện riêng. Bạn có thể chuyển đổi bất kỳ lúc nào.
          </p>
        </div>

        <div className="grid w-full max-w-4xl gap-5 md:grid-cols-2">
          {OPTIONS.map((opt) => {
            const active = switching === opt.mode;
            const isCrypto = opt.mode === 'crypto';

            return (
              <button
                key={opt.mode}
                type="button"
                data-reveal
                onClick={() => choose(opt.mode)}
                disabled={switching !== null}
                style={{ opacity: 0 }}
                className={cn(
                  'group relative w-full overflow-hidden rounded-[2rem] border p-8 text-left transition-all',
                  'bg-[--color-card] backdrop-blur-xl disabled:opacity-70',
                  isCrypto
                    ? 'border-[--color-primary]/25 hover:border-[--color-primary]/55'
                    : 'border-emerald-500/25 hover:border-emerald-400/55',
                )}
              >
                <BorderBeam duration={isCrypto ? 8 : 10} size={90} />
                <div
                  className={cn(
                    'pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl transition-opacity',
                    isCrypto ? 'bg-[--color-primary]/20' : 'bg-emerald-500/20',
                    'opacity-70 group-hover:opacity-100',
                  )}
                />

                <div className="relative">
                  <div className="mb-6 flex items-start justify-between">
                    <span
                      className={cn(
                        'grid h-14 w-14 place-items-center rounded-2xl border',
                        isCrypto
                          ? 'border-[--color-primary]/40 bg-[--color-primary-soft] text-[--color-primary]'
                          : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
                      )}
                    >
                      <AppIcon name={opt.icon} size={28} />
                    </span>
                    <Badge variant={isCrypto ? 'primary' : 'success'} dot>
                      {opt.badge}
                    </Badge>
                  </div>

                  <h3 className="mb-2 font-display text-2xl font-extrabold text-white">
                    {opt.title} —{' '}
                    <span className={isCrypto ? 'text-[--color-primary]' : 'text-emerald-400'}>
                      {opt.suffix}
                    </span>
                  </h3>
                  <p className="mb-6 text-sm leading-relaxed text-[--color-muted-foreground]">
                    {opt.description}
                  </p>

                  <ul className="mb-8 space-y-2.5">
                    {opt.points.map((p) => (
                      <li
                        key={p.label}
                        className="flex items-center gap-2.5 text-sm text-white/85"
                      >
                        <AppIcon
                          name={p.icon}
                          size={16}
                          className={isCrypto ? 'text-[--color-primary]' : 'text-emerald-400'}
                        />
                        {p.label}
                      </li>
                    ))}
                  </ul>

                  <span
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition-colors',
                      active
                        ? isCrypto
                          ? 'bg-[--color-primary] text-[--color-primary-foreground]'
                          : 'bg-emerald-500 text-[#04160b]'
                        : isCrypto
                          ? 'bg-[--color-primary-soft] text-[--color-primary] group-hover:bg-[--color-primary] group-hover:text-[--color-primary-foreground]'
                          : 'bg-emerald-500/15 text-emerald-300 group-hover:bg-emerald-500 group-hover:text-[#04160b]',
                    )}
                  >
                    {active ? 'Đang mở...' : `Mở ${opt.title}`}
                    <AppIcon name="lucide:arrow-right" size={16} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <p
          data-reveal
          className="mt-12 flex items-center gap-1.5 text-xs text-[--color-muted-foreground]"
          style={{ opacity: 0 }}
        >
          <AppIcon name="lucide:shield-check" size={14} />
          JWT bảo vệ phiên · khoá ví crypto không bao giờ rời trình duyệt
        </p>
      </main>
    </div>
  );
}
