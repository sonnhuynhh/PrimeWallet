import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { WebGLBackground } from '@/components/effects/WebGLBackground';
import { useAnimeReveal } from '@/components/effects/useAnimeReveal';
import { BorderBeam } from '@/components/effects/BorderBeam';
import { AppIcon } from '@/components/ui/AppIcon';

/**
 * Khung Đăng nhập / Đăng ký — panel glass kiểu Uniswap trên nền WebGL.
 */
export function AuthLayout({
  title,
  description,
  tagline,
  children,
  footer,
  reversed = false,
}: {
  title: string;
  description: string;
  tagline: string;
  children: ReactNode;
  footer: ReactNode;
  reversed?: boolean;
}) {
  const brandRef = useAnimeReveal('[data-reveal]');

  return (
    <div className="noise-overlay relative flex min-h-screen flex-col overflow-hidden bg-[--color-background] md:flex-row">
      <WebGLBackground className="opacity-70" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(252,114,255,0.16),transparent_45%),radial-gradient(ellipse_at_80%_80%,rgba(76,130,251,0.12),transparent_40%)]"
      />

      <div
        ref={brandRef}
        className={`relative flex flex-1 flex-col justify-center p-10 ${
          reversed ? 'order-1 md:order-2' : ''
        }`}
      >
        <div className="mx-auto max-w-md text-center">
          <span
            data-reveal
            className="mx-auto mb-7 grid h-20 w-20 place-items-center rounded-[1.75rem] bg-[--color-primary-soft] ring-1 ring-[--color-primary]/35"
            style={{ opacity: 0 }}
          >
            <AppIcon name="lucide:wallet" size={36} className="text-[--color-primary]" />
          </span>

          <h1
            data-reveal
            className="font-display text-4xl font-extrabold tracking-tight text-white lg:text-5xl"
            style={{ opacity: 0 }}
          >
            Prime<span className="text-gradient-uni">Wallet</span>
          </h1>
          <p
            data-reveal
            className="mt-4 leading-relaxed text-[--color-muted-foreground]"
            style={{ opacity: 0 }}
          >
            {tagline}
          </p>

          <p
            data-reveal
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-[--color-border] bg-white/[0.03] px-4 py-2 text-xs font-semibold text-[--color-muted-foreground]"
            style={{ opacity: 0 }}
          >
            <AppIcon name="lucide:shield-check" size={14} className="text-[--color-success]" />
            Khoá riêng tư không rời khỏi trình duyệt
          </p>
        </div>
      </div>

      <div
        className={`relative flex flex-1 flex-col justify-center px-6 py-12 md:px-12 lg:px-20 ${
          reversed ? 'order-2 md:order-1' : ''
        }`}
      >
        <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-[2rem] border border-[--color-border] bg-[--color-card] p-8 shadow-[0_40px_100px_-48px_rgba(252,114,255,0.45)] backdrop-blur-xl">
          <BorderBeam duration={9} size={100} />

          <Link
            to="/"
            className="mb-7 inline-flex items-center gap-1.5 text-sm font-semibold text-[--color-muted-foreground] transition-colors hover:text-white"
          >
            <AppIcon name="lucide:arrow-left" size={16} /> Về trang giới thiệu
          </Link>

          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white">
            {title}
          </h2>
          <p className="mt-2 mb-8 text-[--color-muted-foreground]">{description}</p>

          {children}

          <div className="mt-8 text-center text-sm text-[--color-muted-foreground]">{footer}</div>
        </div>
      </div>
    </div>
  );
}
