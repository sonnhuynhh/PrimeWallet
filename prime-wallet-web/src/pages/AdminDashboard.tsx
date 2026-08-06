import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Users, Lock, Unlock, CheckCircle, XCircle, RefreshCw, FileText, ChevronLeft, ChevronRight, LayoutDashboard, Search, Bitcoin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAllUsers, updateKycStatus, lockUser, unlockUser, getAuditLogs, runReconciliation, getAdminCryptoHistory } from '../services/admin';
import type { AdminUserResponse, Page } from '../services/admin';
import type { AuditLogResponse } from '../types/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function AdminDashboard() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'crypto'>('users');
  const [usersPage, setUsersPage] = useState<Page<AdminUserResponse> | null>(null);
  const [logsPage, setLogsPage] = useState<Page<AuditLogResponse> | null>(null);
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  // Crypto Tab States
  const [cryptoAddress, setCryptoAddress] = useState('');
  const [cryptoHistory, setCryptoHistory] = useState<import('../services/crypto').EtherscanTransaction[]>([]);
  const [cryptoLoading, setCryptoLoading] = useState(false);

  const fetchData = async (page: number) => {
    try {
      setLoading(true);
      if (activeTab === 'users') {
        const data = await getAllUsers(page, 20);
        setUsersPage(data);
      } else {
        const data = await getAuditLogs(page, 20);
        setLogsPage(data);
      }
      setCurrentPage(page);
    } catch (e: any) {
      alert("Lỗi tải dữ liệu: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    try {
      if (!window.confirm("Bạn có chắc chắn muốn chạy đối soát hệ thống bây giờ? Thao tác này có thể mất một lúc.")) return;
      setReconciling(true);
      await runReconciliation();
      alert("Chạy đối soát thành công. Hệ thống đã kiểm tra và ghi lại các phát hiện vào Log.");
      if (activeTab === 'logs') fetchData(0);
    } catch (error: any) {
      alert("Lỗi khi chạy đối soát: " + error.message);
    } finally {
      setReconciling(false);
    }
  };

  const handleSearchCrypto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cryptoAddress) return;
    try {
      setCryptoLoading(true);
      const res = await getAdminCryptoHistory(cryptoAddress);
      if (res.status === "1") {
        setCryptoHistory(res.result);
      } else {
        setCryptoHistory([]);
      }
    } catch (error: any) {
      alert("Lỗi tra cứu ví: " + error.message);
    } finally {
      setCryptoLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'crypto') {
      fetchData(0);
    }
  }, [activeTab]);

  const handleToggleLock = async (user: AdminUserResponse) => {
    try {
      if (user.status === 'LOCKED') {
        if (window.confirm(`Bạn có chắc muốn MỞ KHÓA tài khoản ${user.email}?`)) {
          await unlockUser(user.id);
          fetchData(currentPage);
        }
      } else {
        if (window.confirm(`Bạn có chắc muốn KHÓA tài khoản ${user.email}?`)) {
          await lockUser(user.id);
          fetchData(currentPage);
        }
      }
    } catch (e: any) {
      alert("Lỗi: " + e.message);
    }
  };

  const handleUpdateKyc = async (user: AdminUserResponse, status: 'VERIFIED' | 'REJECTED') => {
    try {
      let note = 'Admin update';
      if (status === 'REJECTED') {
        const reason = window.prompt("Nhập lý do từ chối KYC:");
        if (reason === null) return; // User cancelled
        note = reason || 'Không có lý do';
      } else {
        if (!window.confirm(`Xác nhận duyệt KYC cho ${user.email}?`)) return;
      }
      await updateKycStatus(user.id, status, note);
      fetchData(currentPage);
    } catch (e: any) {
      alert("Lỗi cập nhật KYC: " + e.message);
    }
  };

  if (session?.auth?.role !== 'ADMIN') {
    return <div className="p-8 text-red-500">Bạn không có quyền truy cập trang này.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-slate-200">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <div className="bg-red-500/20 p-4 rounded-2xl border border-red-500/30">
              <ShieldAlert className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-2">
                <LayoutDashboard className="w-8 h-8 text-emerald-400" />
                Quản trị Hệ thống
              </h1>
              <p className="text-slate-400 mt-2">Quản lý người dùng, KYC, hoạt động và đối soát</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <Button onClick={handleReconcile} loading={reconciling} className="w-auto flex items-center gap-2 bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.3)]" title="Chạy Đối Soát">
              Chạy Đối Soát
            </Button>
            <Button variant="secondary" onClick={() => window.location.href = '/'} className="w-auto flex items-center gap-2" title="Quay lại Ví">
              Quay lại Ví
            </Button>
          </div>
        </div>

        <div className="flex gap-4 border-b border-slate-800 pb-px">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-4 px-2 font-bold transition-colors ${activeTab === 'users' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'}`}
          >
            <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Người dùng</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-4 px-2 font-bold transition-colors ${activeTab === 'logs' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'}`}
          >
            <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Lịch sử hoạt động (Audit Logs)</span>
          </button>
          <button
            onClick={() => setActiveTab('crypto')}
            className={`pb-4 px-2 font-bold transition-colors ${activeTab === 'crypto' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'}`}
          >
            <span className="flex items-center gap-2"><Bitcoin className="w-4 h-4" /> Tra cứu Blockchain</span>
          </button>
        </div>

        {activeTab === 'crypto' ? (
          <Card>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
                <Bitcoin className="w-5 h-5 text-violet-400" /> Tra cứu ví Etherscan (Sepolia Testnet)
              </h2>
              <p className="text-slate-400 text-sm">Nhập địa chỉ ví Web3 bất kỳ để xem toàn bộ lịch sử giao dịch (Không giới hạn quyền sở hữu).</p>
            </div>
            
            <form onSubmit={handleSearchCrypto} className="flex gap-4 mb-6">
              <input
                type="text"
                placeholder="Ví dụ: 0x123..."
                value={cryptoAddress}
                onChange={e => setCryptoAddress(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors"
                required
              />
              <Button loading={cryptoLoading} type="submit" className="w-auto px-8 bg-violet-600 hover:bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.3)]" title="Tra cứu">
                <Search className="w-5 h-5 mr-2" /> Tra cứu
              </Button>
            </form>

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-900">
                  <tr className="border-b border-slate-800 text-slate-400 text-sm">
                    <th className="p-4 font-semibold">Hash</th>
                    <th className="p-4 font-semibold">Thời gian</th>
                    <th className="p-4 font-semibold">Từ / Đến</th>
                    <th className="p-4 font-semibold">Số lượng (ETH)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {cryptoHistory.map(tx => {
                    const isReceive = tx.to.toLowerCase() === cryptoAddress.toLowerCase();
                    const ethValue = (Number(tx.value) / 1e18).toFixed(6);
                    return (
                      <tr key={tx.hash} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 text-xs text-slate-400 font-mono">
                          {tx.hash.substring(0, 16)}...
                        </td>
                        <td className="p-4 text-sm text-slate-300">
                          {new Date(Number(tx.timeStamp) * 1000).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold mr-2 ${isReceive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {isReceive ? 'NHẬN' : 'GỬI'}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            {isReceive ? 'Từ: ' + tx.from.substring(0, 8) + '...' : 'Đến: ' + tx.to.substring(0, 8) + '...'}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-white">
                          {ethValue} ETH
                        </td>
                      </tr>
                    );
                  })}
                  {!cryptoHistory.length && !cryptoLoading && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">Nhập địa chỉ ví để xem giao dịch</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {activeTab === 'users' ? (
                  <><Users className="w-5 h-5 text-emerald-400" /> Danh sách người dùng</>
                ) : (
                  <><FileText className="w-5 h-5 text-emerald-400" /> Lịch sử hoạt động</>
                )}
              </h2>
              <Button variant="secondary" onClick={() => fetchData(currentPage)} className="w-auto py-2 flex items-center gap-2" title="Tải lại">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Tải lại
              </Button>
            </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                {activeTab === 'users' ? (
                  <tr className="border-b border-slate-800 text-slate-400 text-sm">
                    <th className="p-4 font-semibold">Tên / Email</th>
                    <th className="p-4 font-semibold">Trạng thái KYC</th>
                    <th className="p-4 font-semibold">Trạng thái Tài khoản</th>
                    <th className="p-4 font-semibold text-right">Thao tác</th>
                  </tr>
                ) : (
                  <tr className="border-b border-slate-800 text-slate-400 text-sm">
                    <th className="p-4 font-semibold">Thời gian</th>
                    <th className="p-4 font-semibold">Hành động</th>
                    <th className="p-4 font-semibold">Chi tiết</th>
                    <th className="p-4 font-semibold">IP Address</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {activeTab === 'users' ? (
                  usersPage?.content.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-white">{user.fullName}</p>
                        <p className="text-sm text-slate-400">{user.email}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          user.kycStatus === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-400' :
                          user.kycStatus === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {user.kycStatus}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          user.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="p-4 flex gap-2 justify-end">
                        {user.kycStatus !== 'VERIFIED' && (
                          <button onClick={() => handleUpdateKyc(user, 'VERIFIED')} className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors" title="Duyệt KYC">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {user.kycStatus !== 'REJECTED' && (
                          <button onClick={() => handleUpdateKyc(user, 'REJECTED')} className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors" title="Từ chối KYC">
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => handleToggleLock(user)} 
                          className={`p-2 rounded-lg transition-colors ${user.status === 'LOCKED' ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}
                          title={user.status === 'LOCKED' ? 'Mở khóa' : 'Khóa tài khoản'}
                        >
                          {user.status === 'LOCKED' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  logsPage?.content.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 text-sm text-slate-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 rounded text-xs font-bold bg-slate-800 text-slate-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-300">{log.detail}</td>
                      <td className="p-4 text-xs text-slate-500">{log.ipAddress || 'N/A'}</td>
                    </tr>
                  ))
                )}
                
                {(activeTab === 'users' ? !usersPage?.content?.length : !logsPage?.content?.length) && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">Không có dữ liệu</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
            <div className="flex justify-between items-center mt-6">
              <Button 
                variant="secondary" 
                className="w-auto py-2 flex items-center gap-1" 
                disabled={currentPage === 0} 
                onClick={() => fetchData(currentPage - 1)} 
                title="Trước"
              >
                <ChevronLeft className="w-4 h-4" /> Trước
              </Button>
              <span className="text-sm text-slate-400">
                Trang {currentPage + 1} / {activeTab === 'users' ? (usersPage?.totalPages || 1) : (logsPage?.totalPages || 1)}
              </span>
              <Button 
                variant="secondary" 
                className="w-auto py-2 flex items-center gap-1" 
                disabled={currentPage >= ((activeTab === 'users' ? usersPage?.totalPages : logsPage?.totalPages) || 1) - 1} 
                onClick={() => fetchData(currentPage + 1)} 
                title="Sau"
              >
                Sau <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
