import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { toastErr } from '../components/feedback/toast';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await signIn({ email, password });
      navigate('/');
    } catch (error) {
      toastErr(error, 'Đăng nhập không thành công');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Đăng nhập"
      description="Chào mừng bạn trở lại với PrimeWallet."
      tagline="Ví VND có cổng VNPAY thật, ví crypto non-custodial trên 5 mạng blockchain — cùng một tài khoản."
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-bold text-violet-400 hover:underline">
            Đăng ký ngay
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="space-y-5">
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
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        <Button type="submit" title="Đăng nhập" loading={loading} className="w-full" />
      </form>
    </AuthLayout>
  );
}
