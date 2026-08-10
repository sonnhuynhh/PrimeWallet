import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { extractMessage } from '@/components/feedback/toast';

interface Props {
  children: React.ReactNode;
  /** Tên khu vực để hiển thị trong thông báo (VD "Swap", "Lịch sử"). */
  label?: string;
  /** Giao diện thay thế tuỳ biến. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  /** Đổi giá trị này sẽ tự reset boundary (VD `key`/tab hiện tại). */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
  /** Bản sao `resetKey` đã thấy, để phát hiện prop đổi ngay trong lượt render. */
  seenResetKey: unknown;
}

class BaseBoundary extends React.Component<Props, State> {
  state: State = { error: null, seenResetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  /**
   * Reset ngay trong lượt render thay vì `componentDidUpdate` + `setState`:
   * cách kia render hai lần cho mỗi lần đổi tab và gây giật layout.
   */
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey === state.seenResetKey) return null;
    return { error: null, seenResetKey: props.resetKey };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Không gửi đi đâu cả — chỉ log để dev thấy. Tránh lộ dữ liệu ví ra ngoài.
    console.error(`[${this.props.label ?? 'App'}] lỗi render:`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return null;
  }
}

/**
 * TẦNG 1 — Widget: bao mỗi tab/khối. Lỗi chỉ làm hỏng khối đó, phần còn lại
 * của trang vẫn dùng được. Truyền `resetKey={tab}` để đổi tab là tự hồi phục.
 */
export function WidgetBoundary({ children, label, resetKey }: Props) {
  return (
    <BaseBoundary
      label={label}
      resetKey={resetKey}
      fallback={(error, reset) => (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-rose-300">
                Không tải được {label ? `mục ${label}` : 'khu vực này'}
              </h3>
              <p className="mt-1 break-words text-sm text-slate-400">{extractMessage(error)}</p>
              <Button
                variant="secondary"
                size="sm"
                fullWidth={false}
                className="mt-4"
                onClick={reset}
              >
                <RefreshCw className="h-4 w-4" /> Thử lại
              </Button>
            </div>
          </div>
        </div>
      )}
    >
      {children}
    </BaseBoundary>
  );
}

/**
 * TẦNG 2 — Route: bao từng trang. Lỗi ở đây thì header/nav vẫn còn,
 * người dùng có thể sang trang khác.
 */
export function RouteBoundary({ children, label, resetKey }: Props) {
  return (
    <BaseBoundary
      label={label}
      resetKey={resetKey}
      fallback={(error, reset) => (
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-20 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-rose-500/10">
            <AlertTriangle className="h-8 w-8 text-rose-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Trang gặp sự cố</h2>
          <p className="break-words text-sm text-slate-400">{extractMessage(error)}</p>
          <div className="mt-2 flex gap-3">
            <Button variant="secondary" fullWidth={false} onClick={reset}>
              <RefreshCw className="h-4 w-4" /> Thử lại
            </Button>
            {/* Dùng <a> chứ không <Link>: tải lại cả app để state dựng từ đầu. */}
            <a href="/">
              <Button fullWidth={false}>
                <Home className="h-4 w-4" /> Về trang chủ
              </Button>
            </a>
          </div>
        </div>
      )}
    >
      {children}
    </BaseBoundary>
  );
}

/**
 * TẦNG 3 — Global: bao toàn bộ `<App/>`. Đây là lưới an toàn cuối cùng;
 * chỉ còn cách tải lại trang.
 */
export function GlobalBoundary({ children }: { children: React.ReactNode }) {
  return (
    <BaseBoundary
      label="Global"
      fallback={(error) => (
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-950 p-6 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-rose-500/10">
            <AlertTriangle className="h-10 w-10 text-rose-400" />
          </div>
          <h1 className="text-3xl font-black text-white">PrimeWallet gặp sự cố</h1>
          <p className="max-w-md break-words text-sm text-slate-400">{extractMessage(error)}</p>
          <p className="text-xs text-slate-600">
            Tài sản của bạn vẫn an toàn — khoá riêng tư chưa bao giờ rời khỏi trình duyệt.
          </p>
          <a href="/">
            <Button fullWidth={false} className="mt-2">
              <RefreshCw className="h-4 w-4" /> Tải lại ứng dụng
            </Button>
          </a>
        </div>
      )}
    >
      {children}
    </BaseBoundary>
  );
}
