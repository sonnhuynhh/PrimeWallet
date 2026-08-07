import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, LogOut, UserCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface WalletLayoutProps {
  accent: 'emerald' | 'violet';
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

/**
 * Khung chung cho 2 shell Fiat / Crypto:
 * - Thanh trên hiển thị brand + nút chuyển đổi loại ví (về WalletTypeScreen)
 * - Nút user / logout
 * Nội dung chính nằm trong {children}.
 */
export function WalletLayout({ accent, title, subtitle, children }: WalletLayoutProps) {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();

  const accentText = accent === 'emerald' ? 'text-emerald-400' : 'text-violet-400';
  const accentBg = accent === 'emerald'
    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : 'bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border-violet-500/30';

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-200">
      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/wallet-type')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${accentBg}`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Chuyển ví</span>
            </button>
            <div>
              <h1 className="text-lg font-black text-white leading-tight">
                Prime<span className={accentText}>Wallet</span>
              </h1>
              <p className={`text-[11px] uppercase tracking-widest font-bold ${accentText}`}>{title}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full ${accent === 'emerald' ? 'bg-emerald-500/20' : 'bg-violet-500/20'} flex items-center justify-center`}>
                <UserCircle className={`w-5 h-5 ${accentText}`} />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-bold text-white">{session?.profile.fullName}</p>
                <p className="text-[11px] text-slate-500">{session?.profile.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="p-2.5 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-16 flex-1 w-full">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h2 className="text-3xl font-black text-white">{title}</h2>
            <p className="mt-1 text-slate-400">{subtitle}</p>
          </motion.div>
          {children}
        </div>
      </main>
    </div>
  );
}