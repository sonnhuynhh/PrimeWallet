import { useState } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, CheckCircle2, ArrowDownToLine, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toastOk } from '@/components/feedback/toast';
import { useCrypto } from '../CryptoContext';

/** Tab "Nhận" — QR + địa chỉ, kèm cảnh báo đúng mạng. */
export function ReceiveTab() {
  const { data, address } = useCrypto();
  const { activeWallet, activeNetwork } = data;
  const [copied, setCopied] = useState(false);

  if (!activeWallet || !address) {
    return (
      <Card className="py-10 text-center text-slate-400">
        Liên kết ví để lấy địa chỉ nhận.
      </Card>
    );
  }

  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toastOk('Đã sao chép địa chỉ ví');
    setTimeout(() => setCopied(false), 2000);
  };

  const networkLabel = activeNetwork?.label ?? activeWallet.blockchainNetwork;
  const symbol = activeNetwork?.nativeSymbol ?? 'ETH';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="mx-auto max-w-lg">
        <div className="flex flex-col items-center text-center">
          <div className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-[--color-primary-soft]">
            <ArrowDownToLine className="h-6 w-6 text-[--color-primary]" />
          </div>
          <h3 className="text-xl font-bold text-white">Nhận {symbol}</h3>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
            Mạng {networkLabel}
            {activeNetwork?.testnet ? <Badge variant="warning">Testnet</Badge> : null}
          </p>

          {/* QR trên nền trắng — máy quét đọc ổn định hơn nền tối. */}
          <div className="mt-6 rounded-2xl bg-white p-4">
            <QRCodeSVG value={address} size={200} level="M" />
          </div>

          <div className="mt-6 w-full rounded-xl border border-[--color-border] bg-black/20 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Địa chỉ ví của bạn
            </p>
            <p className="break-all font-mono text-sm text-slate-200">{address}</p>
          </div>

          <Button className="mt-4" onClick={() => void copy()}>
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Đã sao chép' : 'Sao chép địa chỉ'}
          </Button>

          <div className="mt-5 flex w-full items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-left">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-xs text-amber-200/90">
              Chỉ gửi tài sản trên mạng <strong>{networkLabel}</strong> tới địa chỉ này. Gửi từ mạng
              khác có thể làm mất tài sản vĩnh viễn.
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
