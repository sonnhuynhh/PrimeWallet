import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AppIcon } from '@/components/ui/AppIcon';
import { WebGLBackground } from '@/components/effects/WebGLBackground';
import { cn } from '@/lib/utils';

interface WalletLayoutProps {
  accent: 'emerald' | 'violet';
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

/**
 * Chrome app kiểu Uniswap: top bar glass, brand + accent shell,
 * nền WebGL rất nhẹ phía sau nội dung.
 */
export function WalletLayout({ accent, title, subtitle, children }: WalletLayoutProps) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const isFiat = accent === 'emerald';

  return (
    <div
      data-shell={isFiat ? 'fiat' : 'crypto'}
      className="noise-overlay relative min-h-screen bg-[--color-background] text-[--color-foreground]"
    >
      <WebGLBackground className="fixed inset-0 opacity-35" />
      <div
        aria-hidden
        className={cn(
          'pointer-events-none fixed inset-x-0 top-0 h-72',
          isFiat
            ? 'bg-[radial-gradient(ellipse_at_top,rgba(33,201,94,0.14),transparent_60%)]'
            : 'bg-[radial-gradient(ellipse_at_top,rgba(252,114,255,0.16),transparent_60%)]',
        )}
      />

      <header className="sticky top-0 z-30 border-b border-[--color-border] bg-[#131313]/72 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate('/wallet-type')}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[--color-border] bg-white/[0.03] px-2.5 py-2 text-sm font-semibold text-white transition-colors hover:border-[--color-primary]/45 hover:bg-[--color-primary-soft] sm:px-3"
            >
              <AppIcon name="lucide:arrow-left-right" size={15} className="text-[--color-primary]" />
              <span className="hidden sm:inline">Chuyển ví</span>
            </button>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-sm font-extrabold tracking-tight text-white sm:text-base">
                Prime<span className="text-[--color-primary]">Wallet</span>
              </p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[--color-primary]">
                {title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2.5 md:flex">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[--color-primary-soft] text-[--color-primary]">
                <AppIcon name="lucide:user-round" size={18} />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-white">{session?.profile.fullName}</p>
                <p className="text-[11px] text-[--color-muted-foreground]">
                  {session?.profile.email}
                </p>
              </div>
            </div>

            {session?.auth?.role === 'ADMIN' ? (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20"
                title="Quản trị hệ thống"
              >
                <AppIcon name="lucide:shield-alert" size={15} />
                <span className="hidden sm:inline">Quản trị</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={signOut}
              className="grid h-10 w-10 place-items-center rounded-full text-red-400 transition-colors hover:bg-red-500/10"
              title="Đăng xuất"
            >
              <AppIcon name="lucide:log-out" size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 sm:mb-7">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            {title}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-[--color-muted-foreground]">
            {subtitle}
          </p>
        </div>
        {children}
      </main>
    </div>
  );
}
