import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { AdminDashboard } from './pages/AdminDashboard'
import { VnPayReturn } from './pages/VnPayReturn'
import { WalletTypeScreen } from './pages/WalletTypeScreen'
import { FiatShell } from './components/wallet/FiatShell'
import { CryptoShell } from './components/wallet/CryptoShell'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">Loading...</div>;
  if (!session) return <Navigate to="/login" />;
  return <>{children}</>;
}

/** Điểm vào: nếu chưa chọn loại ví → màn hình chọn; đã chọn → vào đúng shell tương ứng. */
function WalletEntry() {
  const { activeWalletMode } = useAuth();
  if (activeWalletMode === 'fiat') return <Navigate to="/fiat" replace />;
  if (activeWalletMode === 'crypto') return <Navigate to="/crypto" replace />;
  return <Navigate to="/wallet-type" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/vnpay-return" element={<VnPayReturn />} />
      <Route path="/admin" element={
        <ProtectedRoute>
          <AdminDashboard />
        </ProtectedRoute>
      } />

      {/* Chọn loại ví */}
      <Route path="/wallet-type" element={
        <ProtectedRoute>
          <WalletTypeScreen />
        </ProtectedRoute>
      } />

      {/* Ví Fiat */}
      <Route path="/fiat" element={
        <ProtectedRoute>
          <FiatShell />
        </ProtectedRoute>
      } />

      {/* Ví Crypto */}
      <Route path="/crypto" element={
        <ProtectedRoute>
          <CryptoShell />
        </ProtectedRoute>
      } />

      {/* Mặc định điều hướng theo mode đã chọn */}
      <Route path="/" element={
        <ProtectedRoute>
          <WalletEntry />
        </ProtectedRoute>
      } />
    </Routes>
  )
}

export default App