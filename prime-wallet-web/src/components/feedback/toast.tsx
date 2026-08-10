import { Toaster as SonnerToaster, toast as sonner } from 'sonner';
import { CheckCircle2, XCircle, Info, Loader2, ExternalLink } from 'lucide-react';

/**
 * Hệ thống toast — thay thế TOÀN BỘ `alert()` trong app.
 *
 * Bọc `sonner` để mọi nơi dùng cùng một giao diện, và để lỗi luôn hiển thị
 * đủ lâu cho người dùng đọc được (lỗi blockchain thường dài).
 */

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      duration={4200}
      toastOptions={{
        style: {
          background: 'rgba(27, 27, 27, 0.96)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#f5f5f5',
          backdropFilter: 'blur(16px)',
          borderRadius: '1.25rem',
          boxShadow: '0 24px 80px -40px rgba(252, 114, 255, 0.35)',
        },
      }}
    />
  );
}

export function toastOk(message: string, description?: string) {
  return sonner.success(message, {
    description,
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
  });
}

export function toastErr(error: unknown, fallback = 'Đã xảy ra lỗi') {
  const message = extractMessage(error, fallback);
  return sonner.error(message, {
    // Lỗi on-chain dài — cho thêm thời gian đọc.
    duration: 8000,
    icon: <XCircle className="h-5 w-5 text-rose-400" />,
  });
}

export function toastInfo(message: string, description?: string) {
  return sonner.message(message, {
    description,
    icon: <Info className="h-5 w-5 text-sky-400" />,
  });
}

export function toastLoading(message: string) {
  return sonner.loading(message, {
    icon: <Loader2 className="h-5 w-5 animate-spin text-[--color-primary]" />,
    duration: Number.POSITIVE_INFINITY,
  });
}

export function toastDismiss(id?: string | number) {
  sonner.dismiss(id);
}

/** Toast giao dịch: có link explorer để người dùng tự kiểm tra on-chain. */
export function toastTx(
  message: string,
  opts: { hash: string; explorerUrl?: string | null; description?: string },
) {
  const { hash, explorerUrl, description } = opts;
  return sonner.success(message, {
    description,
    duration: 10000,
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
    action: explorerUrl
      ? {
          label: (
            <span className="inline-flex items-center gap-1">
              Xem <ExternalLink className="h-3 w-3" />
            </span>
          ) as unknown as string,
          onClick: () => window.open(`${explorerUrl}/tx/${hash}`, '_blank', 'noopener,noreferrer'),
        }
      : undefined,
  });
}

/**
 * Bóc thông điệp người-đọc-được từ lỗi bất kỳ.
 * Lỗi từ viem/RPC hay lồng nhiều tầng `cause`, nên đi ngược lên tối đa 8 tầng.
 */
export function extractMessage(error: unknown, fallback = 'Đã xảy ra lỗi'): string {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return fallback;

  let current: unknown = error;
  const messages: string[] = [];

  for (let depth = 0; depth < 8 && current && typeof current === 'object'; depth += 1) {
    const obj = current as { shortMessage?: string; details?: string; message?: string; cause?: unknown };
    if (obj.shortMessage) messages.push(obj.shortMessage);
    else if (obj.details) messages.push(obj.details);
    else if (obj.message) messages.push(obj.message);
    current = obj.cause;
  }

  // Ưu tiên thông điệp ngắn gọn nhất có nghĩa (thường là shortMessage ngoài cùng).
  return messages[0] ?? fallback;
}
