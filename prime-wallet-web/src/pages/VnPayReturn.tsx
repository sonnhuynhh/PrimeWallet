import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { confirmVnPayPayment } from '../services/payment';
import { motion } from 'framer-motion';
import { AppIcon } from '@/components/ui/AppIcon';

export function VnPayReturn() {
  const [searchParams] = useSearchParams();
  const { reloadSession } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Đang xác nhận giao dịch với máy chủ...');

  useEffect(() => {
    const run = async () => {
      try {
        const query = searchParams.toString();
        if (!query) {
          setStatus('error');
          setMessage('Thiếu thông tin giao dịch từ VNPAY.');
          return;
        }

        const result = await confirmVnPayPayment(`?${query}`);
        await reloadSession();

        if (result.credited || result.alreadyProcessed) {
          setStatus('success');
          setMessage(result.message);
          // Báo cửa sổ cha (FiatShell) reload số dư
          if (window.opener) {
            window.opener.postMessage({ type: 'vnpay:success' }, window.location.origin);
          }
          setTimeout(() => window.close(), 2500);
        } else {
          setStatus('error');
          setMessage(result.message);
        }
      } catch (e) {
        console.error('Lỗi khi xác nhận VNPAY', e);
        setStatus('error');
        setMessage(e instanceof Error ? e.message : 'Không xác nhận được giao dịch.');
      }
    };
    void run();
  }, [searchParams, reloadSession]);

  const isSuccess = status === 'success';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[--color-background] p-4">
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-full max-w-md rounded-[2rem] border p-8 text-center ${
          isSuccess
            ? 'border-emerald-500/30 bg-emerald-500/10'
            : status === 'error'
              ? 'border-rose-500/30 bg-rose-500/10'
              : 'border-[--color-border] bg-[--color-card]'
        }`}
      >
        {status === 'loading' ? (
          <div className="mx-auto mb-6 h-14 w-14 animate-spin rounded-full border-4 border-[--color-primary]/20 border-t-[--color-primary]" />
        ) : (
          <div
            className={`mx-auto mb-6 grid h-14 w-14 place-items-center rounded-full ${
              isSuccess ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}
          >
            <AppIcon
              name={isSuccess ? 'lucide:check-circle-2' : 'lucide:x-circle'}
              size={28}
            />
          </div>
        )}
        <h2 className="font-display text-xl font-bold text-white">
          {status === 'loading'
            ? 'Đang xử lý giao dịch...'
            : isSuccess
              ? 'Nạp tiền thành công!'
              : 'Giao dịch chưa hoàn tất'}
        </h2>
        <p className="mt-2 text-sm text-[--color-muted-foreground]">{message}</p>
        {status !== 'loading' ? (
          <button
            type="button"
            onClick={() => window.close()}
            className="mt-6 w-full rounded-full border border-[--color-border] bg-white/[0.05] py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Đóng cửa sổ
          </button>
        ) : null}
      </motion.div>
    </div>
  );
}
