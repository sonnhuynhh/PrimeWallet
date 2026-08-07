import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, Plus, ArrowRightLeft, Receipt, UserCircle, ShieldAlert, CheckCircle2, ArrowDownLeft, Pencil, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { WalletLayout } from './WalletLayout';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { createPaymentUrl } from '../../services/payment';
import { transfer, withdraw, getTransactionHistory, getMyAccounts } from '../../services/wallet';
import type { TransactionResponse } from '../../types/api';
import { createIdempotencyKey } from '../../utils/uuid';
import { AiInsightsPanel } from '../ai/AiInsightsPanel';

/**
 * Ví Fiat — giao diện riêng cho tài khoản VND.
 * Tính năng: nạp tiền (VNPAY), chuyển tiền, thanh toán hóa đơn, lịch sử giao dịch,
 * hồ sơ cá nhân + chỉnh sửa thông tin + đổi mật khẩu.
 */
export function FiatShell() {
  const { session, reloadSession, updateProfile, changePassword } = useAuth();

  // ===== Fiat tabs =====
  const [tab, setTab] = useState<'overview' | 'history' | 'profile'>('overview');

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
  const [billProvider, setBillProvider] = useState('Điện lực EVN');
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
      console.warn('Không tải được lịch sử', e);
    } finally {
      setFiatLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab]);

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
    } catch (err: any) {
      alert('Lỗi nạp tiền: ' + err.message);
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
      alert('Chuyển tiền thành công!');
      setTransferOpen(false);
      setTransferAccount(''); setTransferAmount(''); setTransferDesc('');
    } catch (err: any) {
      alert('Lỗi chuyển tiền: ' + err.message);
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
      alert('Thanh toán hóa đơn thành công!');
      setBillOpen(false);
      setBillCode(''); setBillAmount('');
    } catch (err: any) {
      alert('Lỗi thanh toán: ' + err.message);
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
      alert('Cập nhật thông tin thành công!');
    } catch (err: any) {
      alert('Lỗi cập nhật: ' + err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdNew !== pwdConfirm) {
      alert('Mật khẩu xác nhận không khớp!');
      return;
    }
    try {
      setPwdSaving(true);
      await changePassword({
        currentPassword: pwdCurrent,
        newPassword: pwdNew,
        confirmNewPassword: pwdConfirm,
      });
      alert('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
      setChangePwdOpen(false);
      setPwdCurrent(''); setPwdNew(''); setPwdConfirm('');
      // Đổi mật khẩu không invalidate token ngay, user có thể tự đăng xuất.
    } catch (err: any) {
      alert('Lỗi đổi mật khẩu: ' + err.message);
    } finally {
      setPwdSaving(false);
    }
  };

  const kycBadge = () => {
    const k = session?.profile.kycStatus;
    if (k === 'VERIFIED')
      return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> Đã xác minh</span>;
    if (k === 'PENDING')
      return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-bold"><Receipt className="w-3.5 h-3.5" /> Đang chờ duyệt</span>;
    return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold"><ShieldAlert className="w-3.5 h-3.5" /> Chưa xác minh</span>;
  };

  const txSign = (tx: TransactionResponse) => {
    const positive = tx.transactionType === 'TOPUP' || (tx.transactionType === 'TRANSFER' && Number(tx.amount) >= 0);
    return {
      plus: positive,
      sign: positive ? '+' : '-',
      color: positive ? 'text-emerald-400' : 'text-red-400',
    };
  };

  const tabs = [
    { id: 'overview' as const, label: 'Tổng quan', icon: Wallet },
    { id: 'history' as const, label: 'Lịch sử', icon: Receipt },
    { id: 'profile' as const, label: 'Hồ sơ', icon: UserCircle },
  ];

  return (
    <WalletLayout
      accent="emerald"
      title="Ví Fiat (VND)"
      subtitle="Tài khoản tiền Việt Nam của bạn"
    >
      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              tab === t.id
                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <motion.div key="overview" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Balance card */}
          <Card className="border-emerald-500/20 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full" />
            <div className="relative">
              <p className="text-slate-400 text-sm font-semibold mb-2 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" /> Số dư khả dụng
              </p>
              <div className="flex items-baseline gap-2">
                <h1 className="text-5xl font-black text-white">{fmtNumber(balance)}</h1>
                <span className="text-2xl text-emerald-400 font-bold">VND</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <p className="text-slate-500">Số tài khoản:</p>
                <p className="font-mono font-bold text-slate-300">{session?.account?.accountNumber}</p>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-4">
                <Button onClick={() => setDepositOpen(true)} variant="primary" title="Nạp Tiền" className="flex-1" />
                <Button onClick={() => setTransferOpen(true)} variant="secondary" title="Chuyển Tiền" className="flex-1" />
                <Button onClick={() => setBillOpen(true)} title="Thanh Toán Hóa Đơn" className="flex-1 bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20" />
              </div>
            </div>
          </Card>

          {/* AI Insights */}
          <AiInsightsPanel />

          {/* Quick actions / recent */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-emerald-500/10">
              <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                <ArrowRightLeft className="w-5 h-5 text-emerald-400" /> Tính năng Fiat nhanh
              </h3>
              <div className="space-y-3">
                <button onClick={() => setDepositOpen(true)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-900 hover:bg-slate-800 transition-colors border border-slate-800">
                  <span className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center"><Plus className="w-5 h-5 text-emerald-400" /></span>
                  <span className="text-sm font-bold text-slate-200">Nạp tiền qua VNPAY</span>
                </button>
                <button onClick={() => setTransferOpen(true)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-900 hover:bg-slate-800 transition-colors border border-slate-800">
                  <span className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center"><ArrowRightLeft className="w-5 h-5 text-emerald-400" /></span>
                  <span className="text-sm font-bold text-slate-200">Chuyển tiền VND</span>
                </button>
                <button onClick={() => setBillOpen(true)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-900 hover:bg-slate-800 transition-colors border border-slate-800">
                  <span className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center"><Receipt className="w-5 h-5 text-amber-400" /></span>
                  <span className="text-sm font-bold text-slate-200">Thanh toán hóa đơn</span>
                </button>
              </div>
            </Card>

            <Card className="border-transparent bg-slate-900/60">
              <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-4"><UserCircle className="w-5 h-5 text-emerald-400" /> Thông tin tài khoản</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
                    <p className="text-xs text-slate-500 mb-1">Chủ tài khoản</p>
                    <p className="font-bold text-white">{session?.profile.fullName}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
                    <p className="text-xs text-slate-500 mb-1">Trạng thái KYC</p>
                    <div className="mt-1">{kycBadge()}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
                    <p className="text-xs text-slate-500 mb-1">Số điện thoại</p>
                    <p className="font-bold text-white">{session?.profile.phone || 'Chưa cập nhật'}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700">
                    <p className="text-xs text-slate-500 mb-1">Ngày sinh</p>
                    <p className="font-bold text-white">{session?.profile.dateOfBirth || '—'}</p>
                  </div>
                </div>
                <button onClick={() => { setTab('profile'); }} className="w-full text-left text-sm font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                  Quản lý hồ sơ & bảo mật <Pencil size={14} />
                </button>
              </div>
            </Card>
          </div>
        </motion.div>
      )}

      {tab === 'history' && (
        <motion.div key="history" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-4"><Receipt className="w-5 h-5 text-emerald-400" /> Lịch sử giao dịch</h3>
            {fiatLoading ? (
              <p className="text-slate-400 text-center py-6">Đang tải lịch sử...</p>
            ) : fiatHistory.length === 0 ? (
              <p className="text-slate-500 text-center py-6">Chưa có giao dịch nào.</p>
            ) : (
              <div className="space-y-3">
                {fiatHistory.map((tx) => {
                  const s = txSign(tx);
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.plus ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                          {s.plus ? <ArrowDownLeft className="w-5 h-5 text-emerald-400" /> : <ArrowRightLeft className="w-5 h-5 text-red-400" />}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{tx.description}</p>
                          <p className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString('vi-VN')} · {tx.referenceNumber}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className={`font-black ${s.color}`}>{s.sign}{fmtNumber(Math.abs(Number(tx.amount)))} VND</p>
                        <p className="text-xs text-slate-500 font-bold">{tx.transactionType}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {tab === 'profile' && (
        <motion.div key="profile" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card>
            <div className="flex items-center gap-5 border-b border-slate-800 pb-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                <UserCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{session?.profile.fullName}</h2>
                <p className="text-sm text-slate-400">{session?.profile.email}</p>
                <div className="mt-2">{kycBadge()}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Số điện thoại</p>
                <p className="font-bold text-white">{session?.profile.phone || 'Chưa cập nhật'}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Ngày sinh</p>
                <p className="font-bold text-white">{session?.profile.dateOfBirth || '—'}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Cấp độ tài khoản</p>
                <p className="font-bold text-emerald-400">Tiêu chuẩn</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Ngày tham gia</p>
                <p className="font-bold text-white">{session?.profile.createdAt ? new Date(session.profile.createdAt).toLocaleDateString('vi-VN') : '—'}</p>
              </div>
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-transparent">
              <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-4"><Pencil className="w-5 h-5 text-emerald-400" /> Hồ sơ cá nhân</h3>
              <Button variant="secondary" title="Chỉnh sửa hồ sơ" onClick={openEditProfile} />
            </Card>
            <Card className="border-transparent">
              <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-4"><Lock className="w-5 h-5 text-emerald-400" /> Bảo mật</h3>
              <Button variant="secondary" title="Đổi mật khẩu" onClick={() => setChangePwdOpen(true)} />
            </Card>
          </div>
        </motion.div>
      )}

      {/* ===== Modals ===== */}
      <Modal isOpen={depositOpen} onClose={() => setDepositOpen(false)} title="Nạp Tiền VNPAY">
        <form onSubmit={handleDeposit} className="space-y-6">
          <Input label="Số tiền cần nạp (VND)" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} type="number" placeholder="VD: 100000" required />
          <Button type="submit" title="Xác nhận Nạp" loading={depositLoading} />
        </form>
      </Modal>

      <Modal isOpen={transferOpen} onClose={() => setTransferOpen(false)} title="Chuyển Tiền VND">
        <form onSubmit={handleTransfer} className="space-y-6">
          <Input label="Số tài khoản nhận" value={transferAccount} onChange={(e) => setTransferAccount(e.target.value)} placeholder="PW00001234" required />
          <Input label="Số tiền (VND)" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} type="number" placeholder="100000" required />
          <Input label="Nội dung" value={transferDesc} onChange={(e) => setTransferDesc(e.target.value)} placeholder="Chuyển tiền ăn trưa..." required />
          <Button type="submit" title="Thực hiện chuyển" loading={transferLoading} />
        </form>
      </Modal>

      <Modal isOpen={billOpen} onClose={() => setBillOpen(false)} title="Thanh Toán Hóa Đơn">
        <form onSubmit={handleBill} className="space-y-6">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Nhà cung cấp</label>
            <select value={billProvider} onChange={(e) => setBillProvider(e.target.value)} className="w-full bg-slate-900 p-4 rounded-xl border border-slate-700 text-white outline-none focus:border-emerald-500">
              <option value="Điện lực EVN">Điện lực EVN</option>
              <option value="Nước sạch Sawaco">Nước sạch Sawaco</option>
              <option value="Internet VNPT">Internet VNPT</option>
              <option value="Internet FPT">Internet FPT</option>
            </select>
          </div>
          <Input label="Mã khách hàng (mã hóa đơn)" value={billCode} onChange={(e) => setBillCode(e.target.value)} placeholder="PE0123456789" required />
          <Input label="Số tiền thanh toán (VND)" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} type="number" placeholder="100000" required />
          <Button type="submit" title="Thanh toán" loading={billLoading} />
        </form>
      </Modal>

      <Modal isOpen={editProfileOpen} onClose={() => setEditProfileOpen(false)} title="Chỉnh sửa hồ sơ">
        <form onSubmit={handleEditProfile} className="space-y-6">
          <Input label="Họ và tên" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} required />
          <Input label="Ngày sinh (YYYY-MM-DD)" value={editDob} onChange={(e) => setEditDob(e.target.value)} placeholder="2000-01-15" />
          <Button type="submit" title="Lưu thay đổi" loading={editSaving} />
        </form>
      </Modal>

      <Modal isOpen={changePwdOpen} onClose={() => setChangePwdOpen(false)} title="Đổi mật khẩu">
        <form onSubmit={handleChangePassword} className="space-y-6">
          <Input label="Mật khẩu hiện tại" value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)} type="password" autoComplete="current-password" required />
          <Input label="Mật khẩu mới" value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} type="password" autoComplete="new-password" required />
          <Input label="Xác nhận mật khẩu mới" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} type="password" autoComplete="new-password" required />
          <Button type="submit" title="Đổi mật khẩu" loading={pwdSaving} />
        </form>
      </Modal>
    </WalletLayout>
  );
}

function fmtNumber(n: number) {
  return n.toLocaleString('vi-VN');
}