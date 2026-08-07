import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { processVnPayReturn } from '../services/payment';
import { motion } from 'framer-motion';

export function VnPayReturn() {
  const [searchParams] = useSearchParams();
  const { reloadSession } = useAuth();

  useEffect(() => {
    const processPayment = async () => {
      try {
        const query = searchParams.toString();
        if (query) {
          await processVnPayReturn(`?${query}`);
          await reloadSession();
          window.close(); // Close the popup
        }
      } catch (e) {
        console.error("Lỗi khi xử lý VNPAY Return", e);
      }
    };
    processPayment();
  }, [searchParams, reloadSession]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 border border-emerald-500/30 p-8 rounded-3xl max-w-md w-full text-center"
      >
        <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6"></div>
        <h2 className="text-2xl font-bold text-white mb-2">Đang xử lý giao dịch...</h2>
        <p className="text-slate-400">Vui lòng không đóng cửa sổ này, hệ thống đang đồng bộ số dư của bạn.</p>
      </motion.div>
    </div>
  );
}
