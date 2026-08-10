import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Wallet, Plus, ArrowRightLeft, Receipt, UserCircle, ShieldAlert, CheckCircle2,
  ArrowDownLeft, Pencil, Lock, TrendingUp, TrendingDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { WalletLayout } from './WalletLayout';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { TabBar, type TabItem } from '../ui/TabBar';
import { SkeletonRow } from '../ui/Skeleton';
import { WidgetBoundary } from '../error/Boundaries';
import { BorderBeam } from '@/components/effects/BorderBeam';
import { toastOk, toastErr } from '../feedback/toast';
import { createPaymentUrl } from '../../services/payment';
import { transfer, withdraw, getTransactionHistory, getMyAccounts } from '../../services/wallet';
import type { TransactionResponse } from '../../types/api';
import { createIdempotencyKey } from '../../utils/uuid';
import { setCryptoTabIntent } from '@/lib/navIntent';
import { AiInsightsPanel } from '../ai/AiInsightsPanel';
import { fmtVnd, fmtNumber } from '@/lib/utils';

type FiatTab = 'overview' | 'history' | 'profile';

const TABS: readonly TabItem<FiatTab>[] = [
  { id: 'overview', label: 'Tổng quan', icon: Wallet },
  { id: 'history', label: 'Lịch sử', icon: Receipt },
  { id: 'profile', label: 'Hồ sơ', icon: UserCircle },
];

const BILL_PROVIDERS = [
  'Điện lực EVN',
  'Nước sạch Sawaco',
  'Internet VNPT',
  'Internet FPT',
] as const;

/**
 * Ví Fiat — giao diện riêng cho tài khoản VND.
 * Tính năng: nạp tiền (VNPAY), chuyển tiền, thanh toán hóa đơn, lịch sử giao dịch,
 * hồ sơ cá nhân + chỉnh sửa thông tin + đổi mật khẩu.
 */
export function FiatShell() {
  const navigate = useNavigate();
  const { session, reloadSession, updateProfile, changePassword, setActiveWalletMode } = useAuth();

  const [tab, setTab] = useState<FiatTab>('overview');

  // ===== Modals =====
  const [depositOpen, setDepositOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [changePwdOpen, setChangePwdOpen] = useState(false);

  // ===== Deposit =====
  const [depositAmount, setDepositAmount] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);

  // ===== Transfer =====
  const [transferAccount, setTransferAccount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  // ===== Bill =====
  const [billProvider, setBillProvider] = useState<string>(BILL_PROVIDERS[0]);
  const [billCode, setBillCode] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billLoading, setBillLoading] = useState(false);

  // ===== History =====
  const [fiatHistory, setFiatHistory] = useState<TransactionResponse[]>([]);
  const [fiatLoading, setFiatLoading] = useState(false);

  // ===== Edit profile =====
  const [editFullName, setEditFullName] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // ===== Change password =====
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  const balance = Number(session?.account?.balance || 0);

  const loadHistory = async () => {
    try {
      setFiatLoading(true);
      const accounts = await getMyAccounts();
      if (accounts.length > 0) {
        const res = await getTransactionHistory(accounts[0].id);
        setFiatHistory(res.content);
      }
    } catch (e) {
      toastErr(e, 'Không tải được lịch sử giao dịch');
    } finally {
      setFiatLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab]);

  // Reload số dư khi popup VNPAY đóng hoặc báo thành công
  useEffect(() => {
    const onFocus = () => void reloadSession();
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'vnpay:success') void reloadSession();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('message', onMessage);
    };
  }, [reloadSession]);

  // ===== Handlers =====
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setDepositLoading(true);
      const res = await createPaymentUrl(Number(depositAmount), 'Nạp tiền VNPAY');
      const width = 600, height = 800;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(res.paymentUrl, 'VNPAY', `width=${width},height=${height},left=${left},top=${top}`);
      setDepositOpen(false);
      setDepositAmount('');
      toastOk('Đã mở cổng VNPAY', 'Hoàn tất thanh toán ở cửa sổ vừa mở để cộng tiền vào ví.');
    } catch (err) {
      toastErr(err, 'Không tạo được yêu cầu nạp tiền');
    } finally {
      setDepositLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setTransferLoading(true);
      await transfer({
        idempotencyKey: createIdempotencyKey(),
        destinationAccountNumber: transferAccount,
        amount: transferAmount,
        description: transferDesc,
      });
      await reloadSession();
      toastOk('Chuyển tiền thành công', `${fmtVnd(Number(transferAmount))} → ${transferAccount}`);
      setTransferOpen(false);
      setTransferAccount(''); setTransferAmount(''); setTransferDesc('');
    } catch (err) {
      toastErr(err, 'Chuyển tiền thất bại');
    } finally {
      setTransferLoading(false);
    }
  };

  const handleBill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBillLoading(true);
      await withdraw({
        idempotencyKey: createIdempotencyKey(),
        amount: billAmount,
        description: `Thanh toán hóa đơn ${billProvider} - Mã: ${billCode}`,
      });
      await reloadSession();
      toastOk('Thanh toán hóa đơn thành công', `${billProvider} · ${fmtVnd(Number(billAmount))}`);
      setBillOpen(false);
      setBillCode(''); setBillAmount('');
    } catch (err) {
      toastErr(err, 'Thanh toán hóa đơn thất bại');
    } finally {
      setBillLoading(false);
    }
  };

  const openEditProfile = () => {
    setEditFullName(session?.profile.fullName || '');
    setEditDob(session?.profile.dateOfBirth || '');
    setEditProfileOpen(true);
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setEditSaving(true);
      await updateProfile({ fullName: editFullName, dateOfBirth: editDob || null });
      setEditProfileOpen(false);
      toastOk('Cập nhật thông tin thành công');
    } catch (err) {
      toastErr(err, 'Cập nhật thông tin thất bại');
    } finally {
      setEditSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdNew !== pwdConfirm) {
      toastErr('Mật khẩu xác nhận không khớp');
      return;
    }
    try {
      setPwdSaving(true);
      await changePassword({
        currentPassword: pwdCurrent,
        newPassword: pwdNew,
        confirmNewPassword: pwdConfirm,
      });
      toastOk('Đổi mật khẩu thành công', 'Nên đăng xuất rồi đăng nhập lại bằng mật khẩu mới.');
      setChangePwdOpen(false);
      setPwdCurrent(''); setPwdNew(''); setPwdConfirm('');
      // Đổi mật khẩu không invalidate token ngay, user có thể tự đăng xuất.
    } catch (err) {
      toastErr(err, 'Đổi mật khẩu thất bại');
    } finally {
      setPwdSaving(false);
    }
  };

  const kycBadge = () => {
    const k = session?.profile.kycStatus;
    if (k === 'VERIFIED')
      return (
        <Badge variant="success">
          <CheckCircle2 className="h-3.5 w-3.5" /> Đã xác minh
        </Badge>
      );
    if (k === 'PENDING')
      return (
        <Badge variant="warning">
          <Receipt className="h-3.5 w-3.5" /> Đang chờ duyệt
        </Badge>
      );
    return (
      <Badge variant="danger">
        <ShieldAlert className="h-3.5 w-3.5" /> Chưa xác minh
      </Badge>
    );
  };

  return (
    <WalletLayout accent="emerald" title="Ví Fiat (VND)" subtitle="Tài khoản tiền Việt Nam của bạn">
      <TabBar
        tabs={TABS}
        value={tab}
        onChange={setTab}
        layoutId="fiat-tab"
        className="mb-6 w-full sm:mb-8"
      />

      <WidgetBoundary key={tab} label="Ví Fiat">
        {tab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Balance card */}
            <Card className="relative overflow-hidden">
              <BorderBeam />
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[--color-primary-soft] blur-3xl"
              />
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[--color-muted-foreground]">
                <Wallet className="h-4 w-4 text-[--color-primary]" /> Số dư khả dụng
              </p>
              <div className="flex items-baseline gap-3">
                <h1 className="font-display text-5xl font-black tracking-tight text-white md:text-6xl">
                  {fmtNumber(balance, 0)}
                </h1>
                <span className="text-2xl font-black text-[--color-primary]">VND</span>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[--color-border] bg-[--color-surface-2] px-3 py-1.5 text-sm">
                <p className="text-[--color-muted-foreground]">Số tài khoản</p>
                <p className="font-mono font-bold text-white">{session?.account?.accountNumber}</p>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <Button onClick={() => setDepositOpen(true)}>
                  <Plus className="h-4 w-4" /> Nạp tiền
                </Button>
                <Button variant="secondary" onClick={() => setTransferOpen(true)}>
                  <ArrowRightLeft className="h-4 w-4" /> Chuyển tiền
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setBillOpen(true)}
                  className="border-[--color-warning]/30 bg-[--color-warning]/10 text-[--color-warning] hover:bg-[--color-warning]/20"
                >
                  <Receipt className="h-4 w-4" /> Hóa đơn
                </Button>
              </div>
            </Card>

            {/* AI Insights */}
            <AiInsightsPanel />

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader title="Tính năng Fiat nhanh" icon={<ArrowRightLeft className="h-5 w-5" />} />
                <div className="space-y-3">
                  <QuickAction icon={Plus} label="Nạp tiền qua VNPAY" onClick={() => setDepositOpen(true)} />
                  <QuickAction
                    icon={ArrowDownLeft}
                    label="Đổi từ Crypto"
                    onClick={() => {
                      setActiveWalletMode('crypto');
                      setCryptoTabIntent('bridge');
                      navigate('/crypto');
                    }}
                  />
                  <QuickAction icon={ArrowRightLeft} label="Chuyển tiền VND" onClick={() => setTransferOpen(true)} />
                  <QuickAction icon={Receipt} label="Thanh toán hóa đơn" tone="amber" onClick={() => setBillOpen(true)} />
                </div>
              </Card>

              <Card>
                <CardHeader title="Thông tin tài khoản" icon={<UserCircle className="h-5 w-5" />} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Chủ tài khoản" value={session?.profile.fullName} />
                  <div className="rounded-2xl border border-[--color-border] bg-[--color-surface-2] p-4">
                    <p className="mb-2 text-xs text-[--color-muted-foreground]">Trạng thái KYC</p>
                    {kycBadge()}
                  </div>
                  <Field label="Số điện thoại" value={session?.profile.phone || 'Chưa cập nhật'} />
                  <Field label="Ngày sinh" value={session?.profile.dateOfBirth || '—'} />
                </div>
                <button
                  onClick={() => setTab('profile')}
                  className="mt-4 flex items-center gap-1 text-sm font-bold text-[--color-primary] transition-colors hover:brightness-125"
                >
                  Quản lý hồ sơ & bảo mật <Pencil size={14} />
                </button>
              </Card>
            </div>
          </motion.div>
        )}

        {tab === 'history' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader
                title="Lịch sử giao dịch"
                icon={<Receipt className="h-5 w-5" />}
                description="Giao dịch VND gần đây của tài khoản."
              />
              {fiatLoading ? (
                <div className="divide-y divide-[--color-border]">
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
                </div>
              ) : fiatHistory.length === 0 ? (
                <p className="py-8 text-center text-[--color-muted-foreground]">Chưa có giao dịch nào.</p>
              ) : (
                <div className="space-y-2">
                  {fiatHistory.map((tx) => <FiatTxRow key={tx.id} tx={tx} />)}
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {tab === 'profile' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card>
              <div className="flex items-center gap-5 border-b border-[--color-border] pb-6">
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-[--color-primary]/20 bg-[--color-primary-soft]">
                  <UserCircle className="h-8 w-8 text-[--color-primary]" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-black text-white">{session?.profile.fullName}</h2>
                  <p className="text-sm text-[--color-muted-foreground]">{session?.profile.email}</p>
                  <div className="mt-2">{kycBadge()}</div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Field label="Số điện thoại" value={session?.profile.phone || 'Chưa cập nhật'} />
                <Field label="Ngày sinh" value={session?.profile.dateOfBirth || '—'} />
                <Field label="Cấp độ tài khoản" value="Tiêu chuẩn" accent />
                <Field
                  label="Ngày tham gia"
                  value={session?.profile.createdAt ? new Date(session.profile.createdAt).toLocaleDateString('vi-VN') : '—'}
                />
              </div>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader title="Hồ sơ cá nhân" icon={<Pencil className="h-5 w-5" />} />
                <Button variant="secondary" onClick={openEditProfile}>Chỉnh sửa hồ sơ</Button>
              </Card>
              <Card>
                <CardHeader title="Bảo mật" icon={<Lock className="h-5 w-5" />} />
                <Button variant="secondary" onClick={() => setChangePwdOpen(true)}>Đổi mật khẩu</Button>
              </Card>
            </div>
          </motion.div>
        )}
      </WidgetBoundary>

      {/* ===== Modals ===== */}
      <Modal isOpen={depositOpen} onClose={() => setDepositOpen(false)} title="Nạp tiền VNPAY">
        <form onSubmit={handleDeposit} className="space-y-6">
          <Input
            label="Số tiền cần nạp (VND)"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            type="number"
            min="1000"
            placeholder="VD: 100000"
            hint="VNPAY sandbox — số tiền tối thiểu 1.000 VND."
            required
          />
          <Button type="submit" loading={depositLoading}>Xác nhận nạp</Button>
        </form>
      </Modal>

      <Modal isOpen={transferOpen} onClose={() => setTransferOpen(false)} title="Chuyển tiền VND">
        <form onSubmit={handleTransfer} className="space-y-6">
          <Input
            label="Số tài khoản nhận"
            value={transferAccount}
            onChange={(e) => setTransferAccount(e.target.value)}
            placeholder="PW00001234"
            required
          />
          <Input
            label="Số tiền (VND)"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            type="number"
            placeholder="100000"
            hint={`Số dư khả dụng: ${fmtVnd(balance)}`}
            required
          />
          <Input
            label="Nội dung"
            value={transferDesc}
            onChange={(e) => setTransferDesc(e.target.value)}
            placeholder="Chuyển tiền ăn trưa..."
            required
          />
          <Button type="submit" loading={transferLoading}>Thực hiện chuyển</Button>
        </form>
      </Modal>

      <Modal isOpen={billOpen} onClose={() => setBillOpen(false)} title="Thanh toán hóa đơn">
        <form onSubmit={handleBill} className="space-y-6">
          <div className="space-y-1.5">
            <label htmlFor="bill-provider" className="text-sm font-semibold text-slate-300">
              Nhà cung cấp
            </label>
            <select
              id="bill-provider"
              value={billProvider}
              onChange={(e) => setBillProvider(e.target.value)}
              className="w-full rounded-2xl border border-[--color-border] bg-[--color-surface-2] p-4 text-white outline-none transition-colors focus:border-[--color-primary] focus:ring-2 focus:ring-[--color-ring]"
            >
              {BILL_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <Input
            label="Mã khách hàng (mã hóa đơn)"
            value={billCode}
            onChange={(e) => setBillCode(e.target.value)}
            placeholder="PE0123456789"
            required
          />
          <Input
            label="Số tiền thanh toán (VND)"
            value={billAmount}
            onChange={(e) => setBillAmount(e.target.value)}
            type="number"
            placeholder="100000"
            required
          />
          <Button type="submit" loading={billLoading}>Thanh toán</Button>
        </form>
      </Modal>

      <Modal isOpen={editProfileOpen} onClose={() => setEditProfileOpen(false)} title="Chỉnh sửa hồ sơ">
        <form onSubmit={handleEditProfile} className="space-y-6">
          <Input label="Họ và tên" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} required />
          <Input
            label="Ngày sinh"
            value={editDob}
            onChange={(e) => setEditDob(e.target.value)}
            placeholder="2000-01-15"
            hint="Định dạng YYYY-MM-DD"
          />
          <Button type="submit" loading={editSaving}>Lưu thay đổi</Button>
        </form>
      </Modal>

      <Modal isOpen={changePwdOpen} onClose={() => setChangePwdOpen(false)} title="Đổi mật khẩu">
        <form onSubmit={handleChangePassword} className="space-y-6">
          <Input label="Mật khẩu hiện tại" value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)} type="password" autoComplete="current-password" required />
          <Input label="Mật khẩu mới" value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} type="password" autoComplete="new-password" required />
          <Input
            label="Xác nhận mật khẩu mới"
            value={pwdConfirm}
            onChange={(e) => setPwdConfirm(e.target.value)}
            type="password"
            autoComplete="new-password"
            error={pwdConfirm && pwdNew !== pwdConfirm ? 'Mật khẩu xác nhận không khớp' : undefined}
            required
          />
          <Button type="submit" loading={pwdSaving}>Đổi mật khẩu</Button>
        </form>
      </Modal>
    </WalletLayout>
  );
}

/* ===== Bộ phận nhỏ dùng nội bộ trong shell Fiat ===== */

function Field({ label, value, accent }: { label: string; value?: string | null; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-[--color-border] bg-[--color-surface-2] p-4">
      <p className="mb-1 text-xs font-medium tracking-wide text-[--color-muted-foreground] uppercase">{label}</p>
      <p className={accent ? 'font-bold text-[--color-primary]' : 'font-bold text-white'}>{value}</p>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  tone = 'primary',
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  tone?: 'primary' | 'amber';
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-full border border-[--color-border] bg-[--color-surface-2] p-2 pr-5 transition-colors hover:border-[--color-primary]/40 hover:bg-[--color-surface-3]"
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
          tone === 'amber'
            ? 'bg-[--color-warning]/15 text-[--color-warning]'
            : 'bg-[--color-primary-soft] text-[--color-primary]'
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-sm font-bold text-white">{label}</span>
    </button>
  );
}

function FiatTxRow({ tx }: { tx: TransactionResponse }) {
  // TOPUP luôn là tiền vào; TRANSFER âm là tiền ra (backend ký theo hướng giao dịch).
  const positive = tx.transactionType === 'TOPUP' || (tx.transactionType === 'TRANSFER' && Number(tx.amount) >= 0);

  return (
    <div className="flex items-center justify-between rounded-xl border border-[--color-border] bg-black/20 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            positive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
          }`}
        >
          {positive ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowRightLeft className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold text-white">{tx.description}</p>
          <p className="text-xs text-slate-500">
            {new Date(tx.createdAt).toLocaleString('vi-VN')} · {tx.referenceNumber}
          </p>
        </div>
      </div>
      <div className="ml-4 shrink-0 text-right">
        <p className={`flex items-center justify-end gap-1 font-black ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {positive ? '+' : '-'}{fmtVnd(Math.abs(Number(tx.amount)))}
        </p>
        <p className="text-xs font-bold text-slate-500">{tx.transactionType}</p>
      </div>
    </div>
  );
}
