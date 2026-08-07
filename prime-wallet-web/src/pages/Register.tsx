import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export function Register() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await signUp({ email, fullName, password, phone });
      navigate('/');
    } catch (error: any) {
      alert(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950">
      <div className="flex-1 flex flex-col justify-center px-8 md:px-24 order-2 md:order-1">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-3xl font-bold text-white mb-2">Đăng ký tài khoản</h2>
          <p className="text-slate-400 mb-8">Tạo tài khoản PrimeWallet để bắt đầu giao dịch.</p>

          <form onSubmit={handleRegister} className="space-y-6">
            <Input
              label="Họ và tên"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              required
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
            <Input
              label="Số điện thoại"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912345678"
              required
            />
            <Input
              label="Mật khẩu"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <Button type="submit" title="Đăng ký" loading={loading} />
          </form>

          <p className="mt-8 text-center text-slate-400">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-emerald-500 font-bold hover:underline">
              Đăng nhập
            </Link>
          </p>
        </motion.div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-slate-900 border-l border-slate-800 order-1 md:order-2">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center"
        >
          <div className="bg-emerald-500/20 p-6 rounded-full border border-emerald-500/30 mb-6">
            <Wallet className="w-16 h-16 text-emerald-400" />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tight text-center">
            PrimeWallet <span className="text-emerald-500">Web</span>
          </h1>
          <p className="mt-4 text-slate-400 max-w-md text-center leading-relaxed">
            Mở khóa sức mạnh của Web3 ngay trên trình duyệt máy tính của bạn.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
