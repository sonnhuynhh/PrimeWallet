import { motion } from 'framer-motion';
import { Wallet, Bitcoin, ShieldCheck, Globe, TrendingUp, Timer, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

/**
 * Màn hình chọn loại ví (sau đăng nhập).
 * Người dùng chọn 1 trong 2 ví → bộ tính năng + giao diện RIÊNG cho từng ví.
 * - Ví Fiat (VND): xanh ngọc emerald — tính năng ngân hàng truyền thống
 * - Ví Crypto (Web3): tím violet — tính năng blockchain
 */
export function WalletTypeScreen() {
  const { session, signOut, setActiveWalletMode } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState<null | 'fiat' | 'crypto'>(null);

  const choose = (mode: 'fiat' | 'crypto') => {
    setSwitching(mode);
    setActiveWalletMode(mode);
    // delay nhẹ để animation chọn xong rồi mới đổi trang
    setTimeout(() => navigate(mode === 'fiat' ? '/fiat' : '/crypto'), 250);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-slate-200 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-500/10 blur-3xl rounded-full pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 px-8 py-6 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black text-white">
            Prime<span className="text-emerald-500">Wallet</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-white">{session?.profile.fullName}</p>
            <p className="text-xs text-slate-500">{session?.profile.email}</p>
          </div>
          {session?.auth?.role === 'ADMIN' && (
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors"
              title="Quản trị hệ thống"
            >
              <ShieldAlert className="w-4 h-4" /> Quản trị
            </button>
          )}
          <button
            onClick={signOut}
            className="p-2.5 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors"
            title="Đăng xuất"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-12 w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 font-bold mb-3">
            Chào mừng trở lại, {session?.profile.fullName.split(' ').slice(-1)[0]}
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
            Chọn loại ví bạn muốn sử dụng
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">
            Mỗi loại ví có bộ tính năng và giao diện riêng biệt. Bạn có thể chuyển đổi bất kỳ lúc nào.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 w-full max-w-3xl">
          {/* Fiat Card */}
          <motion.button
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => choose('fiat')}
            disabled={switching !== null}
            className="group relative text-left p-8 rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/60 to-slate-900/80 hover:border-emerald-400/60 transition-all disabled:opacity-70"
          >
            <div className="absolute top-6 right-6 w-24 h-24 rounded-full bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors blur-2xl" />
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-6">
                <Wallet className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Ví Fiat — VND</h3>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                Tiền Việt Nam đồng. Tài khoản ngân hàng số, nạp tiền, chuyển tiền, thanh toán hóa đơn.
              </p>
              <ul className="space-y-2.5 mb-8">
                <li className="flex items-center gap-2 text-sm text-slate-300"><Timer className="w-4 h-4 text-emerald-400" /> Nạp tiền qua VNPAY</li>
                <li className="flex items-center gap-2 text-sm text-slate-300"><TrendingUp className="w-4 h-4 text-emerald-400" /> Chuyển / nhận tiền VND</li>
                <li className="flex items-center gap-2 text-sm text-slate-300"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Thanh toán hóa đơn</li>
              </ul>
              <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm ${switching === 'fiat' ? 'bg-emerald-500 text-white' : 'bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white'} transition-colors`}>
                {switching === 'fiat' ? 'Đang mở...' : 'Mở Ví Fiat →'}
              </div>
            </div>
          </motion.button>

          {/* Crypto Card */}
          <motion.button
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => choose('crypto')}
            disabled={switching !== null}
            className="group relative text-left p-8 rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-950/60 to-slate-900/80 hover:border-violet-400/60 transition-all disabled:opacity-70"
          >
            <div className="absolute top-6 right-6 w-24 h-24 rounded-full bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors blur-2xl" />
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center mb-6">
                <Bitcoin className="w-7 h-7 text-violet-400" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Ví Crypto — Web3</h3>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                Tiền mã hóa phi tập trung. ETH, BNB, Polygon, USDT, USDC — bạn nắm giữ chìa khóa của mình.
              </p>
              <ul className="space-y-2.5 mb-8">
                <li className="flex items-center gap-2 text-sm text-slate-300"><Globe className="w-4 h-4 text-violet-400" /> Đa mạng: ETH, BSC, Polygon</li>
                <li className="flex items-center gap-2 text-sm text-slate-300"><Bitcoin className="w-4 h-4 text-violet-400" /> Gửi / nhận coin & token</li>
                <li className="flex items-center gap-2 text-sm text-slate-300"><ShieldCheck className="w-4 h-4 text-violet-400" /> Chỉ bạn giữ private key</li>
              </ul>
              <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm ${switching === 'crypto' ? 'bg-violet-500 text-white' : 'bg-violet-500/15 text-violet-400 group-hover:bg-violet-500 group-hover:text-white'} transition-colors`}>
                {switching === 'crypto' ? 'Đang mở...' : 'Mở Ví Crypto →'}
              </div>
            </div>
          </motion.button>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10 text-xs text-slate-600 flex items-center gap-1.5"
        >
          <ShieldCheck className="w-3.5 h-3.5" /> PrimeWallet bảo vệ cả hai ví bằng xác thực JWT
        </motion.p>
      </main>
    </div>
  );
}