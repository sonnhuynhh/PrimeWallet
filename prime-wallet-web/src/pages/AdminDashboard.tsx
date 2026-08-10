import React, { useEffect, useRef, useState } from 'react';
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

type AdminTab = 'users' | 'logs' | 'crypto' | 'transactions';

const TABS: readonly TabItem<AdminTab>[] = [
  { id: 'users', label: 'Người dùng', icon: Users },
  { id: 'transactions', label: 'Giao dịch', icon: ArrowLeftRight },
  { id: 'logs', label: 'Nhật ký hoạt động', icon: FileText },
  { id: 'crypto', label: 'Tra cứu Blockchain', icon: Bitcoin },
];

/** Nhãn loại giao dịch — gom về một chỗ để bảng và bộ lọc không lệch nhau. */
const TX_TYPES: Record<string, { label: string; variant: 'success' | 'danger' | 'info' | 'warning' }> = {
  TOPUP: { label: 'Nạp', variant: 'success' },
  WITHDRAW: { label: 'Rút', variant: 'danger' },
  TRANSFER: { label: 'Chuyển', variant: 'info' },
  PAYMENT: { label: 'Thanh toán', variant: 'warning' },
};

function TxTypeBadge({ type }: { type: string }) {
  const m = TX_TYPES[type];
  if (!m) return <Badge>{type}</Badge>;
  return (
    <Badge variant={m.variant === 'info' ? 'primary' : m.variant}>{m.label}</Badge>
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
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <Card bare className="p-4">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className={`text-xl font-black ${tone}`}>{value}</p>
    </Card>
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
    try {
      setCryptoLoading(true);
      const res = await getAdminCryptoHistory(address);
      setCryptoHistory(res.status === '1' ? res.result : []);
      setSearchedAddress(address);
      if (res.status !== '1') toastErr(null, 'Không tìm thấy giao dịch nào cho địa chỉ này');
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

        <TabBar tabs={TABS} value={activeTab} onChange={setActiveTab} layoutId="admin-tab" />

        {activeTab === 'crypto' && (
          <Card>
            <CardHeader
              title="Tra cứu ví trên Etherscan"
              description="Nhập địa chỉ ví bất kỳ để xem lịch sử giao dịch on-chain (Sepolia testnet)."
              icon={<Bitcoin className="h-5 w-5" />}
            />

            <form onSubmit={handleSearchCrypto} className="mb-6 flex flex-wrap items-end gap-3">
              <SearchBox
                value={cryptoAddress}
                onChange={setCryptoAddress}
                placeholder="0x..."
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
                    <th className={TH}>Hash</th>
                    <th className={TH}>Thời gian</th>
                    <th className={TH}>Chiều / Đối tác</th>
                    <th className={TH}>Số lượng</th>
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
                      const eth = (Number(tx.value) / 1e18).toFixed(6);
                      const peer = isReceive ? tx.from : tx.to;
                      return (
                        <tr key={tx.hash} className="transition-colors hover:bg-white/3">
                          <td className="p-4 font-mono text-xs text-slate-400">
                            <a
                              href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
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
                            <Badge variant={isReceive ? 'success' : 'danger'}>
                              {isReceive ? 'NHẬN' : 'GỬI'}
                            </Badge>
                            <span className="ml-2 font-mono text-xs text-slate-500">
                              {peer ? `${peer.slice(0, 10)}…${peer.slice(-4)}` : '—'}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-white">{eth} ETH</td>
                        </tr>
                      );
                    })}

                  {!cryptoLoading && !cryptoHistory.length && (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-slate-500">
                        {searchedAddress
                          ? 'Địa chỉ này chưa có giao dịch nào'
                          : 'Nhập địa chỉ ví để bắt đầu tra cứu'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <StatTile icon={User} label="Người dùng" value={fmtNumber(stats?.totalUsers ?? 0, 0)} />
              <StatTile icon={Wallet} label="Ví" value={fmtNumber(stats?.totalAccounts ?? 0, 0)} />
              <StatTile icon={ReceiptText} label="Giao dịch" value={fmtNumber(stats?.totalTransactions ?? 0, 0)} />
              <StatTile icon={ArrowDownToLine} label="Nạp hôm nay" value={fmtVnd(stats?.totalTopUp ?? 0)} tone="text-emerald-400" />
              <StatTile icon={ArrowUpFromLine} label="Rút hôm nay" value={fmtVnd(stats?.totalWithdraw ?? 0)} tone="text-rose-400" />
              <StatTile icon={Send} label="Chuyển hôm nay" value={fmtVnd(stats?.totalTransfer ?? 0)} tone="text-sky-400" />
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
                <select
                  value={txType}
                  onChange={(e) => {
                    setTxType(e.target.value);
                    debouncedFetch(0);
                  }}
                  className="rounded-xl border border-[--color-border] bg-slate-900/80 px-3 text-sm text-slate-300 outline-none focus:border-[--color-primary]"
                >
                  <option value="">Tất cả loại</option>
                  {Object.entries(TX_TYPES).map(([key, m]) => (
                    <option key={key} value={key}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  value={txStatus}
                  onChange={(e) => {
                    setTxStatus(e.target.value);
                    debouncedFetch(0);
                  }}
                  className="rounded-xl border border-[--color-border] bg-slate-900/80 px-3 text-sm text-slate-300 outline-none focus:border-[--color-primary]"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="PENDING">PENDING</option>
                  <option value="FAILED">FAILED</option>
                  <option value="REVERSED">REVERSED</option>
                </select>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[--color-border]">
                <table className="w-full border-collapse">
                  <thead className="bg-white/3">
                    <tr className="border-b border-[--color-border]">
                      <th className={TH}>Mã GD</th>
                      <th className={TH}>Loại</th>
                      <th className={TH}>Nguồn → Đích</th>
                      <th className={`${TH} text-right`}>Số tiền</th>
                      <th className={TH}>Trạng thái</th>
                      <th className={TH}>Thời gian</th>
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
                      <tr>
                        <td colSpan={6} className="p-10 text-center text-slate-500">
                          Không có giao dịch nào khớp bộ lọc
                        </td>
                      </tr>
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
                        <th className={TH}>Tên / Email</th>
                        <th className={TH}>KYC</th>
                        <th className={TH}>Tài khoản</th>
                        <th className={`${TH} text-right`}>Thao tác</th>
                      </>
                    ) : (
                      <>
                        <th className={TH}>Thời gian</th>
                        <th className={TH}>Hành động</th>
                        <th className={TH}>Chi tiết</th>
                        <th className={TH}>IP</th>
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
                          <p className="font-bold text-white">{user.fullName}</p>
                          <p className="text-sm text-slate-400">{user.email}</p>
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
                          {new Date(log.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="p-4">
                          <Badge variant="outline">{log.action}</Badge>
                        </td>
                        <td className="p-4 text-sm text-slate-300">{log.detail}</td>
                        <td className="p-4 font-mono text-xs text-slate-500">{log.ipAddress || 'N/A'}</td>
                      </tr>
                    ))}

                  {!loading &&
                    (activeTab === 'users' ? !usersPage?.content?.length : !logsPage?.content?.length) && (
                      <tr>
                        <td colSpan={4} className="p-10 text-center text-slate-500">
                          Không có dữ liệu
                        </td>
                      </tr>
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

      <Modal isOpen={rejectTarget !== null} onClose={() => setRejectTarget(null)} title="Từ chối KYC" size="sm">
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
