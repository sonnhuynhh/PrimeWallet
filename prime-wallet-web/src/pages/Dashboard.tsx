import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Wallet, Bitcoin, LogOut, ArrowRightLeft, Plus, Receipt, UserCircle, CheckCircle, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { createPaymentUrl } from '../services/payment';
import { transfer, withdraw, getTransactionHistory } from '../services/wallet';
import type { TransactionResponse } from '../types/api';
import { getLinkedWallets, getWalletBalance, broadcastTransaction, linkCryptoWallet, getWalletHistory } from '../services/crypto';
import type { CryptoWallet, WalletBalance, EtherscanTransaction } from '../services/crypto';
import { createIdempotencyKey } from '../utils/uuid';
import { ethers } from 'ethers';

export function Dashboard() {
  const { session, signOut, reloadSession } = useAuth();
  const [activeTab, setActiveTab] = useState<'fiat' | 'crypto' | 'history' | 'profile'>('fiat');

  // Modals state (Fiat)
  const [depositOpen, setDepositOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  
  // Fiat States
  const [depositAmount, setDepositAmount] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  
  const [transferAccount, setTransferAccount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  // Bill States
  const [billProvider, setBillProvider] = useState('Điện lực EVN');
  const [billCode, setBillCode] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billLoading, setBillLoading] = useState(false);

  // Crypto States
  const [cryptoWallet, setCryptoWallet] = useState<CryptoWallet | null>(null);
  const [cryptoBalance, setCryptoBalance] = useState<WalletBalance | null>(null);
  const [cryptoError, setCryptoError] = useState(false);
  const [cryptoCreating, setCryptoCreating] = useState(false);
  
  // Crypto Modals
  const [cryptoTransferOpen, setCryptoTransferOpen] = useState(false);
  const [cryptoToAddress, setCryptoToAddress] = useState('');
  const [cryptoAmount, setCryptoAmount] = useState('');
  const [cryptoTransferLoading, setCryptoTransferLoading] = useState(false);

  const [cryptoHistoryOpen, setCryptoHistoryOpen] = useState(false);
  const [cryptoHistory, setCryptoHistory] = useState<EtherscanTransaction[]>([]);
  const [cryptoHistoryLoading, setCryptoHistoryLoading] = useState(false);
  
  // Fiat History States
  const [fiatHistory, setFiatHistory] = useState<TransactionResponse[]>([]);
  const [fiatHistoryLoading, setFiatHistoryLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'crypto' && !cryptoWallet) {
      loadCryptoWallet();
    }
    if (activeTab === 'history') {
      loadFiatHistory();
    }
  }, [activeTab]);

  const loadFiatHistory = async () => {
    try {
      setFiatHistoryLoading(true);
      // Assuming session.profile has an accountId, or getMyAccount is needed. 
      // Actually wait, I need to fetch the account first if not available.
      // We will fetch the account first if needed, but since it's an MVP we can fetch the first account.
      const accountsResponse = await import('../services/wallet').then(m => m.getMyAccounts());
      if (accountsResponse.length > 0) {
        const historyResponse = await getTransactionHistory(accountsResponse[0].id);
        setFiatHistory(historyResponse.content);
      }
    } catch (e) {
      console.warn("Failed to load history", e);
    } finally {
      setFiatHistoryLoading(false);
    }
  };

  const loadCryptoWallet = async () => {
    try {
      setCryptoError(false);
      const wallets = await getLinkedWallets();
      const sepolia = wallets.find(w => w.blockchainNetwork === 'ETH_SEPOLIA');
      if (sepolia) {
        setCryptoWallet(sepolia);
        try {
          const balance = await getWalletBalance(sepolia.id);
          setCryptoBalance(balance);
        } catch (e) {
          setCryptoError(true);
        }
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const handleCreateCryptoWallet = async () => {
    try {
      setCryptoCreating(true);
      // Tạo ví ngẫu nhiên (chỉ dùng cho mục đích học tập/MVP)
      const randomWallet = ethers.Wallet.createRandom();
      // Lưu private key cục bộ (CẢNH BÁO: Trong thực tế không lưu pk bằng localStorage)
      localStorage.setItem('prime_crypto_pk', randomWallet.privateKey);
      
      await linkCryptoWallet(randomWallet.address, 'ETH_SEPOLIA');
      await loadCryptoWallet();
      alert("Đã khởi tạo ví Crypto thành công!");
    } catch (e: any) {
      alert("Lỗi khởi tạo ví: " + e.message);
    } finally {
      setCryptoCreating(false);
    }
  };

  const handleCryptoTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCryptoTransferLoading(true);
      const pk = localStorage.getItem('prime_crypto_pk');
      if (!pk) throw new Error("Không tìm thấy Private Key. Vui lòng tạo lại ví!");
      
      const provider = new ethers.JsonRpcProvider("https://rpc2.sepolia.org");
      const wallet = new ethers.Wallet(pk, provider);
      
      const tx = await wallet.populateTransaction({
        to: cryptoToAddress,
        value: ethers.parseEther(cryptoAmount)
      });
      
      const signedTx = await wallet.signTransaction(tx);
      const res = await broadcastTransaction(signedTx);
      
      alert("Chuyển ETH thành công! TX Hash: " + res.transactionHash);
      setCryptoTransferOpen(false);
      loadCryptoWallet(); // Refresh balance
    } catch (e: any) {
      alert("Lỗi chuyển tiền crypto: " + e.message);
    } finally {
      setCryptoTransferLoading(false);
    }
  };

  const handleViewCryptoHistory = async () => {
    if (!cryptoWallet) return;
    try {
      setCryptoHistoryOpen(true);
      setCryptoHistoryLoading(true);
      const response = await getWalletHistory(cryptoWallet.id);
      if (response.status === "1") {
        setCryptoHistory(response.result);
      } else {
        setCryptoHistory([]);
      }
    } catch (e: any) {
      alert("Lỗi lấy lịch sử: " + e.message);
    } finally {
      setCryptoHistoryLoading(false);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setDepositLoading(true);
      const response = await createPaymentUrl(Number(depositAmount), "Nạp tiền VNPAY");
      const width = 600;
      const height = 800;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(response.paymentUrl, "VNPAY", `width=${width},height=${height},left=${left},top=${top}`);
      setDepositOpen(false);
    } catch (error: any) {
      alert("Lỗi nạp tiền: " + error.message);
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
        description: transferDesc
      });
      await reloadSession();
      alert("Chuyển tiền thành công!");
      setTransferOpen(false);
    } catch (error: any) {
      alert("Lỗi chuyển tiền: " + error.message);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleBillPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBillLoading(true);
      await withdraw({
        idempotencyKey: createIdempotencyKey(),
        amount: billAmount,
        description: `Thanh toán hóa đơn ${billProvider} - Mã: ${billCode}`
      });
      await reloadSession();
      alert("Thanh toán hóa đơn thành công!");
      setBillOpen(false);
    } catch (error: any) {
      alert("Lỗi thanh toán: " + error.message);
    } finally {
      setBillLoading(false);
    }
  };

  const menuItems = [
    { id: 'fiat', label: 'Ví Fiat (VND)', icon: Wallet, color: 'emerald' },
    { id: 'crypto', label: 'Ví Web3 (ETH)', icon: Bitcoin, color: 'violet' },
    { id: 'history', label: 'Lịch sử giao dịch', icon: Receipt, color: 'blue' },
    { id: 'profile', label: 'Tài khoản & KYC', icon: UserCircle, color: 'amber' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-200">
      {/* Sidebar */}
      <motion.div 
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col"
      >
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            Prime<span className="text-emerald-500">Wallet</span>
          </h1>
        </div>
        
        <div className="p-4 flex-1 flex flex-col gap-2">
          {menuItems.map((item) => (
            <motion.button
              key={item.id}
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                activeTab === item.id 
                  ? item.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                    item.color === 'violet' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' :
                    item.color === 'blue' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-semibold">{item.label}</span>
            </motion.button>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="mb-4 px-2">
            <p className="text-sm font-semibold text-white">{session?.profile.fullName}</p>
            <p className="text-xs text-slate-500 truncate">{session?.profile.email}</p>
          </div>
          {session?.auth.role === 'ADMIN' && (
            <motion.button
              whileHover={{ x: 5 }}
              onClick={() => window.location.href = '/admin'}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-emerald-500/10 text-emerald-400 transition-colors w-full mb-2"
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="font-semibold">Quản trị Hệ thống</span>
            </motion.button>
          )}
          <motion.button
            whileHover={{ x: 5 }}
            onClick={signOut}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors w-full"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-semibold">Đăng xuất</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-8 relative">
        <AnimatePresence mode="wait">
          {activeTab === 'fiat' && (
            <motion.div
              key="fiat"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm uppercase tracking-widest text-emerald-400 font-bold mb-1">Fiat Wallet</h2>
                  <h3 className="text-3xl font-black text-white">Ví VND Của Bạn</h3>
                </div>
              </div>

              <Card className="border-emerald-500/20">
                <p className="text-slate-400 text-sm font-semibold mb-2">Số dư khả dụng</p>
                <div className="flex items-baseline gap-2">
                  <h1 className="text-5xl font-black text-white">
                    {Number(session?.account?.balance || 0).toLocaleString("vi-VN")}
                  </h1>
                  <span className="text-xl text-emerald-400 font-bold">VND</span>
                </div>
                <div className="mt-8 flex gap-4">
                  <Button onClick={() => setDepositOpen(true)} variant="primary" title="Nạp Tiền" className="flex-1" />
                  <Button onClick={() => setTransferOpen(true)} variant="secondary" title="Chuyển Tiền" className="flex-1" />
                  <Button onClick={() => setBillOpen(true)} variant="secondary" title="Thanh Toán Hóa Đơn" className="flex-1 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20" />
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-black text-white">Lịch sử giao dịch</h1>
                  <p className="text-slate-400 mt-2">Toàn bộ giao dịch Fiat của bạn</p>
                </div>
              </div>

              <Card>
                {fiatHistoryLoading ? (
                  <p className="text-slate-400 text-center py-4">Đang tải lịch sử...</p>
                ) : fiatHistory.length === 0 ? (
                  <p className="text-slate-400 text-center py-4">Chưa có giao dịch nào.</p>
                ) : (
                  <div className="space-y-4">
                    {fiatHistory.map(tx => (
                      <div key={tx.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-white">{tx.description}</p>
                          <p className="text-sm text-slate-400">{new Date(tx.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-black ${tx.transactionType === 'TOPUP' || (tx.transactionType === 'TRANSFER' && Number(tx.amount) > 0) ? 'text-emerald-400' : 'text-red-400'}`}>
                            {tx.transactionType === 'TOPUP' || (tx.transactionType === 'TRANSFER' && Number(tx.amount) > 0) ? '+' : '-'}{Math.abs(Number(tx.amount)).toLocaleString('vi-VN')} VND
                          </p>
                          <p className="text-xs text-slate-500 font-bold">{tx.transactionType}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-black text-white">Hồ sơ cá nhân</h1>
                  <p className="text-slate-400 mt-2">Quản lý thông tin và định danh KYC</p>
                </div>
              </div>

              <Card>
                <div className="flex items-center gap-6 mb-8 border-b border-slate-800 pb-8">
                  <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center">
                    <UserCircle className="w-12 h-12 text-slate-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{session?.profile.fullName}</h2>
                    <p className="text-slate-400">{session?.profile.email}</p>
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800">
                      {session?.profile.kycStatus === 'VERIFIED' ? (
                        <><CheckCircle className="w-4 h-4 text-emerald-400" /><span className="text-sm font-bold text-emerald-400">Đã xác minh</span></>
                      ) : session?.profile.kycStatus === 'PENDING' ? (
                        <><Receipt className="w-4 h-4 text-amber-400" /><span className="text-sm font-bold text-amber-400">Đang chờ duyệt</span></>
                      ) : (
                        <><ShieldAlert className="w-4 h-4 text-red-400" /><span className="text-sm font-bold text-red-400">Chưa xác minh</span></>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                      <p className="text-sm text-slate-500 mb-1">Số điện thoại</p>
                      <p className="font-bold text-white">{session?.profile.phone || 'Chưa cập nhật'}</p>
                    </div>
                    <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                      <p className="text-sm text-slate-500 mb-1">Cấp độ tài khoản</p>
                      <p className="font-bold text-emerald-400">Tiêu chuẩn</p>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {activeTab === 'crypto' && (
            <motion.div
              key="crypto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm uppercase tracking-widest text-violet-400 font-bold mb-1">Web3 Wallet</h2>
                  <h3 className="text-3xl font-black text-white">Tài Sản Crypto</h3>
                </div>
              </div>

              <Card className="border-violet-500/20">
                <p className="text-slate-400 text-sm font-semibold mb-2">Số dư khả dụng (Sepolia Testnet)</p>
                
                {cryptoError ? (
                  <div className="py-2">
                    <p className="text-xl font-bold text-red-400">⚠️ Lỗi kết nối mạng</p>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <h1 className="text-5xl font-black text-white">
                      {cryptoBalance?.balanceEth || "0.00"}
                    </h1>
                    <span className="text-xl text-violet-400 font-bold">ETH</span>
                  </div>
                )}
                
                {cryptoWallet && (
                  <p className="text-xs text-slate-500 font-mono mt-2 bg-slate-900 p-2 rounded-lg break-all">
                    {cryptoWallet.walletAddress}
                  </p>
                )}

                <div className="mt-8 flex gap-4">
                  {!cryptoWallet ? (
                    <Button 
                      loading={cryptoCreating} 
                      onClick={handleCreateCryptoWallet} 
                      className="flex-1 bg-violet-600 hover:bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.3)] text-white" 
                      title="Khởi tạo Ví Web3 Mới" 
                    />
                  ) : (
                    <>
                      <Button onClick={() => setCryptoTransferOpen(true)} className="flex-1 bg-violet-600 hover:bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.3)] text-white" title="Chuyển ETH" />
                      <Button onClick={handleViewCryptoHistory} className="flex-1 bg-slate-800 hover:bg-slate-700 text-violet-400 border border-slate-700" title="Lịch sử (Etherscan)" />
                    </>
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals - FIAT */}
      <Modal isOpen={depositOpen} onClose={() => setDepositOpen(false)} title="Nạp Tiền VNPAY">
        <form onSubmit={handleDeposit} className="space-y-6">
          <Input 
            label="Số tiền cần nạp (VND)" 
            value={depositAmount} 
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Ví dụ: 100000"
            type="number"
            required
          />
          <Button type="submit" title="Xác nhận Nạp" loading={depositLoading} />
        </form>
      </Modal>

      <Modal isOpen={transferOpen} onClose={() => setTransferOpen(false)} title="Chuyển Tiền VND">
        <form onSubmit={handleTransfer} className="space-y-6">
          <Input 
            label="Số tài khoản nhận" 
            value={transferAccount} 
            onChange={(e) => setTransferAccount(e.target.value)}
            placeholder="PW00001234"
            required
          />
          <Input 
            label="Số tiền" 
            value={transferAmount} 
            onChange={(e) => setTransferAmount(e.target.value)}
            type="number"
            placeholder="100000"
            required
          />
          <Input 
            label="Nội dung" 
            value={transferDesc} 
            onChange={(e) => setTransferDesc(e.target.value)}
            placeholder="Chuyển tiền ăn trưa..."
            required
          />
          <Button type="submit" title="Thực hiện chuyển" loading={transferLoading} />
        </form>
      </Modal>

      <Modal isOpen={billOpen} onClose={() => setBillOpen(false)} title="Thanh Toán Hóa Đơn">
        <form onSubmit={handleBillPayment} className="space-y-6">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-300">Nhà cung cấp</label>
            <select 
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              value={billProvider}
              onChange={(e) => setBillProvider(e.target.value)}
            >
              <option value="Điện lực EVN">Điện lực EVN</option>
              <option value="Nước sạch Sawaco">Nước sạch Sawaco</option>
              <option value="Internet VNPT">Internet VNPT</option>
              <option value="Internet FPT">Internet FPT</option>
            </select>
          </div>
          <Input 
            label="Mã Khách Hàng (Mã hóa đơn)" 
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
          <Button type="submit" title="Thanh Toán" loading={billLoading} />
        </form>
      </Modal>

      {/* Modals - CRYPTO */}
      <Modal isOpen={cryptoTransferOpen} onClose={() => setCryptoTransferOpen(false)} title="Chuyển ETH (Sepolia)">
        <form onSubmit={handleCryptoTransfer} className="space-y-6">
          <Input 
            label="Địa chỉ ví nhận (0x...)" 
            value={cryptoToAddress} 
            onChange={(e) => setCryptoToAddress(e.target.value)}
            placeholder="0x..."
            required
          />
          <Input 
            label="Số lượng ETH" 
            value={cryptoAmount} 
            onChange={(e) => setCryptoAmount(e.target.value)}
            type="number"
            step="0.000000000000000001"
            placeholder="0.01"
            required
          />
          <Button className="bg-violet-600 hover:bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.3)]" type="submit" title="Ký & Chuyển ETH" loading={cryptoTransferLoading} />
        </form>
      </Modal>

      <Modal isOpen={cryptoHistoryOpen} onClose={() => setCryptoHistoryOpen(false)} title="Lịch sử (Sepolia Etherscan)">
        <div className="max-h-96 overflow-auto">
          {cryptoHistoryLoading ? (
            <p className="text-slate-400 text-center">Đang tải lịch sử từ Etherscan...</p>
          ) : cryptoHistory.length === 0 ? (
            <p className="text-slate-400 text-center">Chưa có giao dịch nào.</p>
          ) : (
            <div className="space-y-3">
              {cryptoHistory.map(tx => {
                const isReceive = tx.to.toLowerCase() === cryptoWallet?.walletAddress.toLowerCase();
                const ethValue = ethers.formatEther(tx.value);
                return (
                  <div key={tx.hash} className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${isReceive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {isReceive ? 'NHẬN' : 'GỬI'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(Number(tx.timeStamp) * 1000).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-slate-400 font-mono truncate max-w-[200px]">
                        Tx: {tx.hash}
                      </span>
                      <span className="font-bold text-white">{ethValue} ETH</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
