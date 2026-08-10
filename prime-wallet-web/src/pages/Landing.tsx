import { Link } from 'react-router-dom';
import { WebGLBackground } from '@/components/effects/WebGLBackground';
import { useAnimeReveal } from '@/components/effects/useAnimeReveal';
import { BorderBeam } from '@/components/effects/BorderBeam';
import { CountUp } from '@/components/marketing/CountUp';
import { Badge } from '@/components/ui/Badge';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { AppIcon } from '@/components/ui/AppIcon';

/**
 * Landing kiểu Uniswap: brand là tín hiệu hero, một headline, một câu phụ,
 * nhóm CTA, mockup ví làm visual chính. Stats / bento nằm dưới fold.
 */
export function Landing() {
  return (
    <div className="noise-overlay relative min-h-screen overflow-x-hidden bg-[--color-background] text-[--color-foreground]">
      <WebGLBackground className="opacity-90" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] bg-[radial-gradient(ellipse_at_top,rgba(252,114,255,0.18),transparent_55%)]"
      />

      <Nav />

      <main className="relative mx-auto max-w-6xl px-6">
        <Hero />
        <Marquee />
        <Stats />
        <BentoFeatures />
        <Security />
        <CallToAction />
      </main>

      <footer className="relative border-t border-[--color-border] py-10 text-center text-sm text-[--color-muted-foreground]">
        PrimeWallet · Ví điện tử đa tài sản · {new Date().getFullYear()}
      </footer>
    </div>
  );
}

function Nav() {
  return (
    <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <Brand mark />
      <nav className="flex items-center gap-2">
        <Link
          to="/login"
          className="rounded-full px-4 py-2 text-sm font-semibold text-[--color-muted-foreground] transition-colors hover:bg-white/5 hover:text-white"
        >
          Đăng nhập
        </Link>
        <Link
          to="/register"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#131313] transition-transform hover:scale-[1.03]"
        >
          Mở ví
          <AppIcon name="lucide:arrow-right" size={16} />
        </Link>
      </nav>
    </header>
  );
}

function Brand({ mark = false, size = 'md' }: { mark?: boolean; size?: 'md' | 'lg' }) {
  return (
    <div className="flex items-center gap-2.5">
      {mark ? (
        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[--color-primary-soft] ring-1 ring-[--color-primary]/35">
          <AppIcon name="lucide:wallet" size={18} className="text-[--color-primary]" />
        </span>
      ) : null}
      <span
        className={
          size === 'lg'
            ? 'font-display text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl'
            : 'font-display text-lg font-extrabold tracking-tight text-white'
        }
      >
        Prime<span className="text-gradient-uni">Wallet</span>
      </span>
    </div>
  );
}

function Hero() {
  const reveal = useAnimeReveal('[data-reveal]');

  return (
    <section
      ref={reveal}
      className="relative grid min-h-[calc(100vh-5.5rem)] items-center gap-12 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-6"
    >
      <div>
        <p
          data-reveal
          className="font-display text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl"
          style={{ opacity: 0 }}
        >
          Prime<span className="text-gradient-uni">Wallet</span>
        </p>

        <h1
          data-reveal
          className="mt-5 max-w-xl font-display text-2xl font-bold leading-snug tracking-tight text-white sm:text-3xl"
          style={{ opacity: 0 }}
        >
          Swap, gửi & giữ tài sản — tiền Việt và on-chain trong một ví.
        </h1>

        <p
          data-reveal
          className="mt-4 max-w-md text-base leading-relaxed text-[--color-muted-foreground]"
          style={{ opacity: 0 }}
        >
          Non-custodial. Khoá riêng tư không bao giờ rời trình duyệt.
        </p>

        <div data-reveal className="mt-8 flex flex-wrap items-center gap-3" style={{ opacity: 0 }}>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-full bg-[--color-primary] px-7 py-3.5 text-sm font-bold text-[--color-primary-foreground] shadow-[0_18px_50px_-18px_#fc72ff] transition-transform hover:scale-[1.03]"
          >
            Bắt đầu miễn phí
            <AppIcon name="lucide:arrow-right" size={18} />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-full border border-[--color-border] bg-white/[0.03] px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/[0.06]"
          >
            Đăng nhập
          </Link>
        </div>
      </div>

      <div data-reveal className="relative" style={{ opacity: 0 }}>
        <div className="absolute -inset-8 -z-10 rounded-full bg-[radial-gradient(circle_at_center,rgba(252,114,255,0.22),transparent_65%)] blur-2xl" />
        <WalletMockup />
      </div>
    </section>
  );
}

function WalletMockup() {
  const rows = [
    { symbol: 'ETH', name: 'Ethereum', amount: '1,284', fiat: '$4.210' },
    { symbol: 'USDC', name: 'USD Coin', amount: '540,00', fiat: '$540' },
    { symbol: 'UNI', name: 'Uniswap', amount: '96,50', fiat: '$812' },
  ];

  return (
    <div className="relative animate-float overflow-hidden rounded-[2rem] border border-white/10 bg-[#1b1b1b]/85 p-6 shadow-[0_40px_120px_-40px_rgba(252,114,255,0.45)] backdrop-blur-xl">
      <BorderBeam duration={8} size={120} />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[--color-primary]">
            Portfolio
          </p>
          <p className="mt-1 font-display text-3xl font-extrabold tracking-tight text-white">
            $<CountUp to={5562} />
          </p>
        </div>
        <Badge variant="primary" dot>
          Sepolia
        </Badge>
      </div>

      <div className="mt-6 space-y-2">
        {rows.map((r) => (
          <div
            key={r.symbol}
            className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/25 px-3.5 py-3"
          >
            <div className="flex items-center gap-3">
              <TokenIcon symbol={r.symbol} size={36} />
              <div>
                <p className="text-sm font-bold text-white">{r.name}</p>
                <p className="text-xs text-[--color-muted-foreground]">
                  {r.amount} {r.symbol}
                </p>
              </div>
            </div>
            <p className="text-sm font-semibold text-white/90">{r.fiat}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="rounded-full bg-[--color-primary] py-3 text-center text-sm font-bold text-[--color-primary-foreground]">
          Swap
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] py-3 text-center text-sm font-bold text-white">
          Gửi
        </div>
      </div>
    </div>
  );
}

function Marquee() {
  const items = [
    'Uniswap V3 engine',
    'LI.FI aggregator',
    'ERC-2612 permit',
    'VNPAY',
    'Sepolia · Base · Amoy',
    'Non-custodial',
    'Allowance revoke',
    'NFT gallery',
  ];
  const loop = [...items, ...items];

  return (
    <div className="relative -mx-6 overflow-hidden border-y border-[--color-border] py-4">
      <div className="flex w-max animate-marquee gap-8 whitespace-nowrap">
        {loop.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[--color-muted-foreground]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[--color-primary]" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function Stats() {
  const items = [
    { value: 5, label: 'Mạng EVM' },
    { value: 8, label: 'Tab crypto' },
    { value: 4, label: 'Bậc phí V3' },
    { value: 0, label: 'Khoá gửi lên server' },
  ];

  return (
    <section className="grid grid-cols-2 gap-4 py-14 lg:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-3xl border border-[--color-border] bg-white/[0.02] px-4 py-6 text-center"
        >
          <p className="font-display text-4xl font-extrabold tracking-tight text-white">
            <CountUp to={it.value} />
          </p>
          <p className="mt-1 text-sm text-[--color-muted-foreground]">{it.label}</p>
        </div>
      ))}
    </section>
  );
}

function BentoFeatures() {
  const cards = [
    {
      icon: 'lucide:repeat',
      title: 'Swap tự tìm đường tốt nhất',
      body: 'Engine Uniswap V3 tự viết trên Sepolia — 36 route ứng viên, chấm điểm theo output ròng sau gas. Mainnet dùng LI.FI.',
      wide: true,
      chips: ['0,01%', '0,05%', '0,3%', '1%', 'Multi-hop', 'Preflight'],
    },
    {
      icon: 'lucide:key-round',
      title: 'Seed chỉ hiện một lần',
      body: 'BIP-39 sinh trên máy bạn. Server chỉ lưu địa chỉ công khai.',
    },
    {
      icon: 'lucide:shield-off',
      title: 'Thu hồi quyền chi tiêu',
      body: 'Quét Approval log, thu hồi spender nguy hiểm bằng một lần bấm.',
    },
    {
      icon: 'lucide:image',
      title: 'Bộ sưu tập NFT',
      body: 'ERC-721 / ERC-1155 kèm ảnh, mở nhanh sang marketplace.',
    },
    {
      icon: 'lucide:layers',
      title: 'Đa chuỗi, một giao diện',
      body: 'Ethereum, Sepolia, BSC, Amoy, Base — đổi mạng không mất ngữ cảnh.',
    },
  ];

  return (
    <section className="py-10 pb-20">
      <SectionHeading
        eyebrow="Tính năng"
        title="Đủ dùng cho tiền pháp định và on-chain"
        description="Ví Fiat lo thanh toán hằng ngày. Ví Crypto lo tài sản số — công cụ ngang tầm ví chuyên dụng."
      />

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <article
            key={c.title}
            className={`group relative overflow-hidden rounded-3xl border border-[--color-border] bg-white/[0.03] p-6 transition-colors hover:border-[--color-primary]/35 ${
              c.wide ? 'md:col-span-2' : ''
            }`}
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[--color-primary-soft] text-[--color-primary]">
              <AppIcon name={c.icon} size={20} />
            </span>
            <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-white">
              {c.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[--color-muted-foreground]">{c.body}</p>
            {c.chips ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {c.chips.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-semibold text-white/80"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function Security() {
  const points = [
    {
      icon: 'lucide:key-round',
      title: 'Không giữ khoá của bạn',
      body: 'Seed nằm trong bộ nhớ tab, xoá sạch khi đóng. Không localStorage, không gửi lên server.',
    },
    {
      icon: 'lucide:shield-check',
      title: 'Chứng minh bằng chữ ký',
      body: 'Liên kết ví qua challenge một lần. Server chỉ recover địa chỉ từ chữ ký.',
    },
    {
      icon: 'lucide:activity',
      title: 'Mô phỏng trước khi ký',
      body: 'Swap chạy thử eth_call. Nếu revert, chặn ký thay vì để bạn mất phí gas.',
    },
  ];

  return (
    <section className="pb-20">
      <SectionHeading
        eyebrow="An toàn"
        title="Tự quản, nhưng không để bạn tự lo một mình"
        description="Không giữ khoá là mặc định. Phần còn lại là các lớp chặn sai sót trước khi tiền rời ví."
      />

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {points.map((p) => (
          <div
            key={p.title}
            className="rounded-3xl border border-[--color-border] bg-white/[0.03] p-6"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[--color-primary-soft] text-[--color-primary]">
              <AppIcon name={p.icon} size={20} />
            </span>
            <h3 className="mt-4 font-display text-lg font-bold text-white">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[--color-muted-foreground]">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CallToAction() {
  return (
    <section className="pb-24">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(252,114,255,0.18),rgba(76,130,251,0.12)_50%,rgba(27,27,27,0.9))] p-10 text-center lg:p-16">
        <BorderBeam duration={10} size={140} />
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-white lg:text-4xl">
          Mở ví trong khoảng một phút
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[--color-muted-foreground]">
          Đăng ký bằng email, chọn ví VND hoặc crypto — đổi qua lại bất cứ lúc nào.
        </p>
        <Link
          to="/register"
          className="mt-9 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-[#131313] transition-transform hover:scale-[1.03]"
        >
          Bắt đầu ngay
          <AppIcon name="lucide:arrow-right" size={18} />
        </Link>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[--color-primary]">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white lg:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-[--color-muted-foreground]">{description}</p>
    </div>
  );
}
