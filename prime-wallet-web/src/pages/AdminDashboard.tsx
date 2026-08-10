import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ShieldAlert,
  Users,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
  Bitcoin,
  ArrowLeftRight,
  User,
  Wallet,
  ReceiptText,
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
  ExternalLink,
  ArrowLeft,
  Hash,
  Clock,
  Mail,
  UserCircle,
  Globe,
  Filter,
  Inbox,
  ShieldCheck,
  Activity,
  LogIn,
  Banknote,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getAllUsers,
  updateKycStatus,
  lockUser,
  unlockUser,
  getAuditLogs,
  runReconciliation,
  getAdminCryptoHistory,
  getAdminTransactions,
  getAdminStats,
} from '../services/admin';
import type { AdminUserResponse, Page, AdminStats } from '../services/admin';
import type { EtherscanTransaction } from '../services/crypto';
import type { AuditLogResponse, TransactionResponse } from '../types/api';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { TabBar, type TabItem } from '../components/ui/TabBar';
import { SkeletonRow } from '../components/ui/Skeleton';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { toastOk, toastErr } from '../components/feedback/toast';
import { AuroraBackground } from '@/components/marketing/AuroraBackground';
import { fmtVnd, fmtNumber } from '@/lib/utils';
import { normalizeEtherscanResult, fetchOnChainTransactions } from '@/lib/onchain/history';
import { formatExplorerError } from '@/lib/etherscan/errors';
import { etherscanApiKey } from '@/lib/env';
import { nativeSymbolOf, txUrl, type NetworkId } from '@/lib/wagmi/chains';
import { isAddress } from 'viem';
import { NetworkIcon } from '@/components/ui/NetworkIcon';
import { cn } from '@/lib/utils';

type AdminTab = 'users' | 'logs' | 'crypto' | 'transactions';

const CRYPTO_NETWORKS: { id: NetworkId; label: string }[] = [
  { id: 'eth_sepolia', label: 'Ethereum Sepolia' },
  { id: 'eth_mainnet', label: 'Ethereum Mainnet' },
  { id: 'bsc_mainnet', label: 'BNB Smart Chain' },
  { id: 'polygon_mainnet', label: 'Polygon' },
  { id: 'base_mainnet', label: 'Base' },
];

const TABS: readonly TabItem<AdminTab>[] = [
  { id: 'users', label: 'Người dùng', icon: Users },
  { id: 'transactions', label: 'Giao dịch', icon: ArrowLeftRight },
  { id: 'logs', label: 'Nhật ký hoạt động', icon: FileText },
  { id: 'crypto', label: 'Tra cứu Blockchain', icon: Bitcoin },
];

/** Nhãn loại giao dịch — gom về một chỗ để bảng và bộ lọc không lệch nhau. */
const TX_TYPES: Record<
  string,
  { label: string; variant: 'success' | 'danger' | 'info' | 'warning'; icon: LucideIcon }
> = {
  TOPUP: { label: 'Nạp', variant: 'success', icon: ArrowDownToLine },
  WITHDRAW: { label: 'Rút', variant: 'danger', icon: ArrowUpFromLine },
  TRANSFER: { label: 'Chuyển', variant: 'info', icon: Send },
  PAYMENT: { label: 'Thanh toán', variant: 'warning', icon: CreditCard },
};

function logActionIcon(action: string): LucideIcon {
  const a = action.toUpperCase();
  if (a.includes('LOGIN') || a.includes('LOGOUT') || a.includes('AUTH')) return LogIn;
  if (a.includes('KYC')) return ShieldCheck;
  if (a.includes('LOCK') || a.includes('UNLOCK')) return Lock;
  if (a.includes('RECONCILE')) return RefreshCw;
  if (a.includes('TRANSFER') || a.includes('PAYMENT') || a.includes('TOPUP') || a.includes('WITHDRAW')) {
    return ArrowLeftRight;
  }
  return Activity;
}

function TxTypeBadge({ type }: { type: string }) {
  const m = TX_TYPES[type];
  if (!m) return <Badge>{type}</Badge>;
  const Icon = m.icon;
  return (
    <Badge variant={m.variant === 'info' ? 'primary' : m.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {m.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'SUCCESS' || status === 'VERIFIED' || status === 'ACTIVE'
      ? 'success'
      : status === 'FAILED' || status === 'REJECTED' || status === 'LOCKED'
        ? 'danger'
        : status === 'PENDING'
          ? 'warning'
          : 'default';
  return <Badge variant={variant} dot>{status}</Badge>;
}

function TxAmount({ tx }: { tx: TransactionResponse }) {
  const value = fmtNumber(tx.amount, 0);
  if (tx.transactionType === 'TOPUP') return <span className="font-bold text-emerald-400">+{value}</span>;
  if (tx.transactionType === 'WITHDRAW') return <span className="font-bold text-rose-400">-{value}</span>;
  return <span className="font-bold text-white">{value}</span>;
}

/** Ô thống kê nhỏ ở tab Giao dịch. */
function StatTile({
  icon: Icon,
  label,
  value,
  tone = 'text-white',
  iconClassName = 'bg-white/5 text-slate-400',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: string;
  iconClassName?: string;
}) {
  return (
    <Card bare className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{label}</p>
          <p className={`text-xl font-black ${tone}`}>{value}</p>
        </div>
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', iconClassName)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </Card>
  );
}

function ThIcon({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={cn(TH, className)}>
      <span className="inline-flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 opacity-70" />
        {children}
      </span>
    </th>
  );
}

function EmptyRow({
  colSpan,
  icon: Icon,
  message,
}: {
  colSpan: number;
  icon: LucideIcon;
  message: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-10 text-center text-slate-500">
        <Icon className="mx-auto mb-3 h-9 w-9 opacity-35" />
        <p>{message}</p>
      </td>
    </tr>
  );
}

/** Ô tìm kiếm dùng chung cho cả 3 tab có phân trang. */
function SearchBox({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      prefix={<Search className="h-4 w-4" />}
      inputClassName="py-2.5"
      className={className}
    />
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="mt-6 flex items-center justify-between">
      <Button
        variant="secondary"
        size="sm"
        fullWidth={false}
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" /> Trước
      </Button>
      <span className="text-sm text-slate-400">
        Trang {page + 1} / {totalPages || 1}
      </span>
      <Button
        variant="secondary"
        size="sm"
        fullWidth={false}
        disabled={page >= (totalPages || 1) - 1}
        onClick={() => onChange(page + 1)}
      >
        Sau <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

const TH = 'p-4 text-left text-xs font-semibold tracking-wider text-slate-400 uppercase';

export function AdminDashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [usersPage, setUsersPage] = useState<Page<AdminUserResponse> | null>(null);
  const [logsPage, setLogsPage] = useState<Page<AuditLogResponse> | null>(null);
  const [txPage, setTxPage] = useState<Page<TransactionResponse> | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  // Tab tra cứu blockchain
  const [cryptoAddress, setCryptoAddress] = useState('');
  const [cryptoNetwork, setCryptoNetwork] = useState<NetworkId>('eth_sepolia');
  const [cryptoHistory, setCryptoHistory] = useState<EtherscanTransaction[]>([]);
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [searchedAddress, setSearchedAddress] = useState('');

  // Tìm kiếm từng tab
  const [userQuery, setUserQuery] = useState('');
  const [logQuery, setLogQuery] = useState('');
  const [txQuery, setTxQuery] = useState('');
  const [txType, setTxType] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [confirm, confirmDialogEl] = useConfirm();

  /** Hộp nhập lý do từ chối KYC — thay `window.prompt`. */
  const [rejectTarget, setRejectTarget] = useState<AdminUserResponse | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchData = async (page: number) => {
    try {
      setLoading(true);
      if (activeTab === 'users') {
        setUsersPage(await getAllUsers(page, 20, userQuery.trim() || undefined));
      } else if (activeTab === 'transactions') {
        setTxPage(
          await getAdminTransactions(
            page,
            20,
            txQuery.trim() || undefined,
            txType || undefined,
            txStatus || undefined,
          ),
        );
      } else {
        setLogsPage(await getAuditLogs(page, 20, undefined, logQuery.trim() || undefined));
      }
      setCurrentPage(page);
    } catch (e) {
      toastErr(e, 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  /** Debounce: chờ gõ xong 400ms rồi mới gọi API — tránh spam request mỗi ký tự. */
  const debouncedFetch = (page: number) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchData(page), 400);
  };

  const loadStats = async () => {
    try {
      setStats(await getAdminStats());
    } catch (e) {
      // Thống kê chỉ là thông tin phụ — hỏng thì bảng vẫn dùng được.
      console.warn('Không tải được thống kê', e);
    }
  };

  const handleReconcile = async () => {
    const ok = await confirm({
      title: 'Chạy đối soát hệ thống?',
      message: 'Thao tác này quét toàn bộ giao dịch và có thể mất một lúc. Kết quả được ghi vào Nhật ký.',
      confirmText: 'Chạy đối soát',
      variant: 'warning',
    });
    if (!ok) return;

    try {
      setReconciling(true);
      await runReconciliation();
      toastOk('Đối soát xong', 'Các phát hiện đã được ghi vào Nhật ký hoạt động');
      if (activeTab === 'logs') fetchData(0);
    } catch (error) {
      toastErr(error, 'Không chạy được đối soát');
    } finally {
      setReconciling(false);
    }
  };

  const handleSearchCrypto = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = cryptoAddress.trim();
    if (!address) return;
    if (!isAddress(address)) {
      toastErr(null, 'Địa chỉ ví không hợp lệ — phải bắt đầu 0x và đủ 42 ký tự (40 hex)');
      return;
    }
    try {
      setCryptoLoading(true);
      const res = await getAdminCryptoHistory(address, cryptoNetwork);
      let txs = normalizeEtherscanResult(res.result);

      // Backend rỗng/lỗi → thử explorer V2 đúng domain (BscScan cho BSC…)
      if (txs.length === 0) {
        const key = etherscanApiKey();
        if (key) txs = await fetchOnChainTransactions(cryptoNetwork, address, key);
      }

      setCryptoHistory(txs);
      setSearchedAddress(address);

      if (txs.length === 0 && res.status !== '1' && !etherscanApiKey()) {
        toastErr(null, formatExplorerError(res.message));
      }
    } catch (error) {
      toastErr(error, 'Không tra cứu được ví');
    } finally {
      setCryptoLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'crypto') return; // tab crypto tự tìm kiếm, không nạp sẵn
    if (activeTab === 'transactions') loadStats();
    fetchData(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleToggleLock = async (user: AdminUserResponse) => {
    const locking = user.status !== 'LOCKED';
    const ok = await confirm({
      title: locking ? 'Khoá tài khoản?' : 'Mở khoá tài khoản?',
      message: locking
        ? `${user.email} sẽ không đăng nhập được cho tới khi được mở khoá.`
        : `${user.email} sẽ đăng nhập lại được bình thường.`,
      confirmText: locking ? 'Khoá' : 'Mở khoá',
      variant: locking ? 'danger' : 'primary',
    });
    if (!ok) return;

    try {
      if (locking) await lockUser(user.id);
      else await unlockUser(user.id);
      toastOk(locking ? 'Đã khoá tài khoản' : 'Đã mở khoá tài khoản');
      fetchData(currentPage);
    } catch (e) {
      toastErr(e, locking ? 'Không khoá được tài khoản' : 'Không mở khoá được tài khoản');
    }
  };

  const handleUpdateKyc = async (user: AdminUserResponse, status: 'VERIFIED' | 'REJECTED') => {
    // Từ chối cần lý do → mở modal riêng; duyệt thì chỉ cần xác nhận.
    if (status === 'REJECTED') {
      setRejectReason('');
      setRejectTarget(user);
      return;
    }

    const ok = await confirm({
      title: 'Duyệt KYC?',
      message: `Xác nhận duyệt KYC cho ${user.email}.`,
      confirmText: 'Duyệt',
      variant: 'primary',
    });
    if (!ok) return;

    try {
      await updateKycStatus(user.id, status, 'Admin update');
      toastOk('Đã duyệt KYC');
      fetchData(currentPage);
    } catch (e) {
      toastErr(e, 'Không cập nhật được KYC');
    }
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    try {
      await updateKycStatus(rejectTarget.id, 'REJECTED', rejectReason.trim() || 'Không có lý do');
      toastOk('Đã từ chối KYC');
      setRejectTarget(null);
      fetchData(currentPage);
    } catch (e) {
      toastErr(e, 'Không cập nhật được KYC');
    }
  };

  if (session?.auth?.role !== 'ADMIN') {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 p-8 text-center">
        <div>
          <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-rose-400" />
          <p className="font-semibold text-rose-400">Bạn không có quyền truy cập trang này.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-200">
      <AuroraBackground />

      <div className="relative z-10 mx-auto max-w-6xl space-y-6 p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[--color-border] pb-6">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-rose-500/30 bg-rose-500/15">
              <ShieldAlert className="h-7 w-7 text-rose-400" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-white md:text-3xl">Quản trị Hệ thống</h1>
              <p className="mt-1 text-sm text-slate-400">
                Người dùng, KYC, giao dịch toàn hệ thống và đối soát
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" fullWidth={false} onClick={() => navigate('/wallet-type')}>
              <ArrowLeft className="h-4 w-4" /> Về trang chính
            </Button>
            <Button
              variant="secondary"
              fullWidth={false}
              loading={reconciling}
              onClick={handleReconcile}
              className="border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
            >
              <RefreshCw className="h-4 w-4" /> Chạy đối soát
            </Button>
          </div>
        </div>

        <TabBar tabs={TABS} value={activeTab} onChange={setActiveTab} layoutId="admin-tab" />

        {activeTab === 'crypto' && (
          <Card>
            <CardHeader
              title="Tra cứu ví trên Blockchain"
              description="Nhập địa chỉ ví và chọn mạng để xem lịch sử giao dịch on-chain qua Etherscan."
              icon={<Bitcoin className="h-5 w-5" />}
            />

            <form onSubmit={handleSearchCrypto} className="mb-6 flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-[--color-border] bg-slate-900/80 px-2">
                <NetworkIcon networkId={cryptoNetwork} size={24} className="ml-1" />
                <select
                  value={cryptoNetwork}
                  onChange={(e) => setCryptoNetwork(e.target.value as NetworkId)}
                  className="h-11 bg-transparent pr-3 text-sm text-slate-300 outline-none focus:border-[--color-primary]"
                >
                  {CRYPTO_NETWORKS.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </div>
              <SearchBox
                value={cryptoAddress}
                onChange={setCryptoAddress}
                placeholder="0x… (42 ký tự)"
                className="min-w-65 flex-1"
              />
              <Button type="submit" fullWidth={false} loading={cryptoLoading} disabled={!cryptoAddress.trim()}>
                <Search className="h-4 w-4" /> Tra cứu
              </Button>
            </form>

            <div className="max-h-130 overflow-x-auto overflow-y-auto rounded-2xl border border-[--color-border]">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur">
                  <tr className="border-b border-[--color-border]">
                    <ThIcon icon={Hash}>Hash</ThIcon>
                    <ThIcon icon={Clock}>Thời gian</ThIcon>
                    <ThIcon icon={ArrowLeftRight}>Chiều / Đối tác</ThIcon>
                    <ThIcon icon={Banknote}>Số lượng</ThIcon>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {cryptoLoading && (
                    <tr>
                      <td colSpan={4} className="px-4">
                        <SkeletonRow />
                        <SkeletonRow />
                        <SkeletonRow />
                      </td>
                    </tr>
                  )}

                  {!cryptoLoading &&
                    cryptoHistory.map((tx) => {
                      const isReceive = tx.to?.toLowerCase() === searchedAddress.toLowerCase();
                      const amount = (Number(tx.value) / 1e18).toFixed(6);
                      const symbol = nativeSymbolOf(cryptoNetwork);
                      const peer = isReceive ? tx.from : tx.to;
                      return (
                        <tr key={tx.hash} className="transition-colors hover:bg-white/3">
                          <td className="p-4 font-mono text-xs text-slate-400">
                            <a
                              href={txUrl(cryptoNetwork, tx.hash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 hover:text-[--color-primary]"
                            >
                              {tx.hash.slice(0, 14)}… <ExternalLink className="h-3 w-3" />
                            </a>
                          </td>
                          <td className="p-4 text-sm text-slate-300">
                            {new Date(Number(tx.timeStamp) * 1000).toLocaleString('vi-VN')}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                                  isReceive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400',
                                )}
                              >
                                {isReceive ? (
                                  <ArrowDownLeft className="h-4 w-4" />
                                ) : (
                                  <ArrowUpRight className="h-4 w-4" />
                                )}
                              </span>
                              <div>
                                <Badge variant={isReceive ? 'success' : 'danger'}>
                                  {isReceive ? 'NHẬN' : 'GỬI'}
                                </Badge>
                                <span className="ml-2 font-mono text-xs text-slate-500">
                                  {peer ? `${peer.slice(0, 10)}…${peer.slice(-4)}` : '—'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 font-bold text-white">
                            <span className="inline-flex items-center gap-1.5">
                              <NetworkIcon networkId={cryptoNetwork} size={18} />
                              {amount} {symbol}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                  {!cryptoLoading && !cryptoHistory.length && (
                    <EmptyRow
                      colSpan={4}
                      icon={Inbox}
                      message={
                        searchedAddress
                          ? 'Địa chỉ này chưa có giao dịch nào'
                          : 'Nhập địa chỉ ví để bắt đầu tra cứu'
                      }
                    />
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <StatTile icon={User} label="Người dùng" value={fmtNumber(stats?.totalUsers ?? 0, 0)} iconClassName="bg-sky-500/15 text-sky-400" />
              <StatTile icon={Wallet} label="Ví" value={fmtNumber(stats?.totalAccounts ?? 0, 0)} iconClassName="bg-violet-500/15 text-violet-400" />
              <StatTile icon={ReceiptText} label="Giao dịch" value={fmtNumber(stats?.totalTransactions ?? 0, 0)} iconClassName="bg-amber-500/15 text-amber-400" />
              <StatTile icon={ArrowDownToLine} label="Nạp hôm nay" value={fmtVnd(stats?.totalTopUp ?? 0)} tone="text-emerald-400" iconClassName="bg-emerald-500/15 text-emerald-400" />
              <StatTile icon={ArrowUpFromLine} label="Rút hôm nay" value={fmtVnd(stats?.totalWithdraw ?? 0)} tone="text-rose-400" iconClassName="bg-rose-500/15 text-rose-400" />
              <StatTile icon={Send} label="Chuyển hôm nay" value={fmtVnd(stats?.totalTransfer ?? 0)} tone="text-sky-400" iconClassName="bg-sky-500/15 text-sky-400" />
            </div>

            <Card>
              <CardHeader
                title="Giao dịch toàn hệ thống"
                icon={<ArrowLeftRight className="h-5 w-5" />}
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    onClick={() => {
                      loadStats();
                      fetchData(currentPage);
                    }}
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Tải lại
                  </Button>
                }
              />

              <div className="mb-5 flex flex-wrap gap-3">
                <SearchBox
                  value={txQuery}
                  onChange={(v) => {
                    setTxQuery(v);
                    debouncedFetch(0);
                  }}
                  placeholder="Tìm theo mã GD, số ví nguồn/đích, mô tả..."
                  className="min-w-60 flex-1"
                />
                <div className="flex items-center gap-2 rounded-xl border border-[--color-border] bg-slate-900/80 px-3">
                  <Filter className="h-4 w-4 text-slate-500" />
                  <select
                    value={txType}
                    onChange={(e) => {
                      setTxType(e.target.value);
                      debouncedFetch(0);
                    }}
                    className="h-11 bg-transparent text-sm text-slate-300 outline-none"
                  >
                    <option value="">Tất cả loại</option>
                    {Object.entries(TX_TYPES).map(([key, m]) => (
                      <option key={key} value={key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-[--color-border] bg-slate-900/80 px-3">
                  <Layers className="h-4 w-4 text-slate-500" />
                  <select
                    value={txStatus}
                    onChange={(e) => {
                      setTxStatus(e.target.value);
                      debouncedFetch(0);
                    }}
                    className="h-11 bg-transparent text-sm text-slate-300 outline-none"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="SUCCESS">SUCCESS</option>
                    <option value="PENDING">PENDING</option>
                    <option value="FAILED">FAILED</option>
                    <option value="REVERSED">REVERSED</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[--color-border]">
                <table className="w-full border-collapse">
                  <thead className="bg-white/3">
                    <tr className="border-b border-[--color-border]">
                      <ThIcon icon={Hash}>Mã GD</ThIcon>
                      <ThIcon icon={Layers}>Loại</ThIcon>
                      <ThIcon icon={ArrowLeftRight}>Nguồn → Đích</ThIcon>
                      <ThIcon icon={Banknote} className="text-right">Số tiền</ThIcon>
                      <ThIcon icon={ShieldCheck}>Trạng thái</ThIcon>
                      <ThIcon icon={Clock}>Thời gian</ThIcon>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loading && (
                      <tr>
                        <td colSpan={6} className="px-4">
                          <SkeletonRow />
                          <SkeletonRow />
                          <SkeletonRow />
                        </td>
                      </tr>
                    )}

                    {!loading &&
                      txPage?.content.map((tx) => (
                        <tr key={tx.id} className="transition-colors hover:bg-white/3">
                          <td className="p-4 font-mono text-xs text-slate-400">{tx.referenceNumber}</td>
                          <td className="p-4">
                            <TxTypeBadge type={tx.transactionType} />
                          </td>
                          <td className="p-4 font-mono text-sm text-slate-300">
                            {tx.sourceAccountNumber || '—'} → {tx.destinationAccountNumber || '—'}
                          </td>
                          <td className="p-4 text-right">
                            <TxAmount tx={tx} />
                          </td>
                          <td className="p-4">
                            <StatusBadge status={tx.status} />
                          </td>
                          <td className="p-4 text-sm text-slate-400">
                            {new Date(tx.createdAt).toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      ))}

                    {!loading && !txPage?.content?.length && (
                      <EmptyRow colSpan={6} icon={ReceiptText} message="Không có giao dịch nào khớp bộ lọc" />
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination page={currentPage} totalPages={txPage?.totalPages ?? 1} onChange={fetchData} />
            </Card>
          </div>
        )}

        {(activeTab === 'users' || activeTab === 'logs') && (
          <Card>
            <CardHeader
              title={activeTab === 'users' ? 'Danh sách người dùng' : 'Nhật ký hoạt động'}
              description={
                activeTab === 'users'
                  ? 'Duyệt KYC, khoá / mở khoá tài khoản.'
                  : 'Mọi thao tác nhạy cảm đều được ghi lại kèm địa chỉ IP.'
              }
              icon={activeTab === 'users' ? <Users className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
              action={
                <Button variant="secondary" size="sm" fullWidth={false} onClick={() => fetchData(currentPage)}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Tải lại
                </Button>
              }
            />

            <SearchBox
              value={activeTab === 'users' ? userQuery : logQuery}
              onChange={(v) => {
                if (activeTab === 'users') setUserQuery(v);
                else setLogQuery(v);
                debouncedFetch(0);
              }}
              placeholder={
                activeTab === 'users'
                  ? 'Tìm theo email, số điện thoại, họ tên...'
                  : 'Tìm theo hành động, chi tiết...'
              }
              className="mb-5 max-w-md"
            />

            <div className="overflow-x-auto rounded-2xl border border-[--color-border]">
              <table className="w-full border-collapse">
                <thead className="bg-white/3">
                  <tr className="border-b border-[--color-border]">
                    {activeTab === 'users' ? (
                      <>
                        <ThIcon icon={UserCircle}>Tên / Email</ThIcon>
                        <ThIcon icon={ShieldCheck}>KYC</ThIcon>
                        <ThIcon icon={User}>Tài khoản</ThIcon>
                        <ThIcon icon={Layers} className="text-right">
                          Thao tác
                        </ThIcon>
                      </>
                    ) : (
                      <>
                        <ThIcon icon={Clock}>Thời gian</ThIcon>
                        <ThIcon icon={Activity}>Hành động</ThIcon>
                        <ThIcon icon={FileText}>Chi tiết</ThIcon>
                        <ThIcon icon={Globe}>IP</ThIcon>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading && (
                    <tr>
                      <td colSpan={4} className="px-4">
                        <SkeletonRow />
                        <SkeletonRow />
                        <SkeletonRow />
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    activeTab === 'users' &&
                    usersPage?.content.map((user) => (
                      <tr key={user.id} className="transition-colors hover:bg-white/3">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-500/15 text-sky-400">
                              <UserCircle className="h-5 w-5" />
                            </span>
                            <div>
                              <p className="font-bold text-white">{user.fullName}</p>
                              <p className="flex items-center gap-1 text-sm text-slate-400">
                                <Mail className="h-3 w-3 opacity-60" />
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <StatusBadge status={user.kycStatus} />
                        </td>
                        <td className="p-4">
                          <StatusBadge status={user.status} />
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            {user.kycStatus !== 'VERIFIED' && (
                              <button
                                onClick={() => handleUpdateKyc(user, 'VERIFIED')}
                                className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 transition-colors hover:bg-emerald-500/20"
                                title="Duyệt KYC"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            )}
                            {user.kycStatus !== 'REJECTED' && (
                              <button
                                onClick={() => handleUpdateKyc(user, 'REJECTED')}
                                className="rounded-lg bg-amber-500/10 p-2 text-amber-400 transition-colors hover:bg-amber-500/20"
                                title="Từ chối KYC"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleLock(user)}
                              className={`rounded-lg p-2 transition-colors ${
                                user.status === 'LOCKED'
                                  ? 'bg-slate-700 text-white hover:bg-slate-600'
                                  : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                              }`}
                              title={user.status === 'LOCKED' ? 'Mở khoá' : 'Khoá tài khoản'}
                            >
                              {user.status === 'LOCKED' ? (
                                <Unlock className="h-4 w-4" />
                              ) : (
                                <Lock className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {!loading &&
                    activeTab === 'logs' &&
                    logsPage?.content.map((log) => (
                      <tr key={log.id} className="transition-colors hover:bg-white/3">
                        <td className="p-4 text-sm text-slate-400">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 opacity-60" />
                            {new Date(log.createdAt).toLocaleString('vi-VN')}
                          </span>
                        </td>
                        <td className="p-4">
                          {(() => {
                            const LogIcon = logActionIcon(log.action);
                            return (
                              <Badge variant="outline" className="gap-1">
                                <LogIcon className="h-3 w-3" />
                                {log.action}
                              </Badge>
                            );
                          })()}
                        </td>
                        <td className="p-4 text-sm text-slate-300">{log.detail}</td>
                        <td className="p-4 font-mono text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5 opacity-60" />
                            {log.ipAddress || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}

                  {!loading &&
                    (activeTab === 'users' ? !usersPage?.content?.length : !logsPage?.content?.length) && (
                      <EmptyRow
                        colSpan={4}
                        icon={activeTab === 'users' ? Users : FileText}
                        message="Không có dữ liệu"
                      />
                    )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={currentPage}
              totalPages={(activeTab === 'users' ? usersPage?.totalPages : logsPage?.totalPages) ?? 1}
              onChange={fetchData}
            />
          </Card>
        )}
      </div>

      {confirmDialogEl}

      <Modal
        isOpen={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title={
          <span className="inline-flex items-center gap-2">
            <XCircle className="h-5 w-5 text-amber-400" />
            Từ chối KYC
          </span>
        }
        size="sm"
      >
        <p className="mb-4 text-sm text-slate-400">
          Lý do sẽ được ghi vào nhật ký kiểm toán và gửi kèm cho{' '}
          <span className="font-bold text-slate-200">{rejectTarget?.email}</span>.
        </p>
        <Input
          label="Lý do từ chối"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="VD: ảnh giấy tờ mờ, thông tin không khớp..."
          autoFocus
        />
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={() => setRejectTarget(null)}>
            Huỷ
          </Button>
          <Button variant="danger" onClick={submitReject}>
            Từ chối KYC
          </Button>
        </div>
      </Modal>
    </div>
  );
}
