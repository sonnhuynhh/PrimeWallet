import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string | React.ReactNode;
  variant?: 'danger' | 'warning' | 'primary';
  confirmText?: string;
  cancelText?: string;
}

const ICON_MAP = {
  danger: <AlertCircle className="h-12 w-12 text-rose-400" />,
  warning: <AlertCircle className="h-12 w-12 text-amber-400" />,
  primary: <AlertCircle className="h-12 w-12 text-[--color-primary]" />,
} as const;

/**
 * Hộp thoại xác nhận — thay thế toàn bộ `confirm()`.
 *
 * Dùng khi cần người dùng xác nhận hành động nguy hiểm (xoá ví, thu hồi allowance, gửi tiền).
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  variant = 'danger',
  confirmText = 'Xác nhận',
  cancelText = 'Huỷ',
}: ConfirmDialogProps) {
  const [loading, setLoading] = React.useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center gap-4 text-center">
        {ICON_MAP[variant]}
        <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
      </div>

      <div className="mt-6 flex gap-3">
        <Button variant="secondary" onClick={onClose} disabled={loading} fullWidth>
          {cancelText}
        </Button>
        <Button
          variant={variant === 'primary' ? 'primary' : 'danger'}
          onClick={handleConfirm}
          loading={loading}
          fullWidth
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Hook quản lý ConfirmDialog (tránh tạo state + modal ở mọi nơi).
 *
 * @example
 * const confirm = useConfirm();
 * const handleDelete = async () => {
 *   const ok = await confirm({ title: 'Xoá ví?', message: 'Hành động này không thể hoàn tác.' });
 *   if (!ok) return;
 *   // tiếp tục xoá
 * };
 */
type ConfirmOptions = Omit<ConfirmDialogProps, 'isOpen' | 'onClose' | 'onConfirm'>;

export function useConfirm() {
  const [state, setState] = React.useState<
    ConfirmOptions & { isOpen: boolean; resolve?: (value: boolean) => void }
  >({ isOpen: false, title: '', message: '' });

  const confirm = React.useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, isOpen: true, resolve });
    });
  }, []);

  const handleConfirm = () => {
    state.resolve?.(true);
    setState((s) => ({ ...s, isOpen: false }));
  };

  const handleClose = () => {
    state.resolve?.(false);
    setState((s) => ({ ...s, isOpen: false }));
  };

  const dialog = (
    <ConfirmDialog
      isOpen={state.isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={state.title}
      message={state.message}
      variant={state.variant}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
    />
  );

  return [confirm, dialog] as const;
}
