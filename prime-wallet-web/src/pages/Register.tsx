import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { toastErr } from '../components/feedback/toast';

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
    } catch (error) {
      toastErr(error, 'Đăng ký không thành công');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      reversed
      title="Đăng ký tài khoản"
      description="Tạo tài khoản PrimeWallet để bắt đầu giao dịch."
      tagline="Một tài khoản cho cả ví VND và ví crypto. Seed phrase sinh ngay trên máy bạn, không bao giờ gửi lên máy chủ."
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-bold text-violet-400 hover:underline">
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={handleRegister} className="space-y-5">
        <Input
          label="Họ và tên"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nguyễn Văn A"
          required
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          required
        />
        <Input
          label="Số điện thoại"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0912345678"
          required
        />
        <Input
          label="Mật khẩu"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        <Button type="submit" title="Đăng ký" loading={loading} className="w-full" />
      </form>
    </AuthLayout>
  );
}
