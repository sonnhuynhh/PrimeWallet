import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { VnPayReturn } from './pages/VnPayReturn'
import { WalletTypeScreen } from './pages/WalletTypeScreen'
import { RouteBoundary } from './components/error/Boundaries'
import { CommandPalette } from './components/ui/CommandPalette'
import { FullPageSpinner } from './components/ui/Skeleton'

/**
 * Ba route nặng nhất được tách chunk riêng: CryptoShell kéo theo cả engine DEX,
 * NFT và allowance scan; AdminDashboard chỉ ADMIN dùng. Khách vào landing/login
 * không phải tải những phần này.
 */
const CryptoShell = lazy(() =>
  import('./components/wallet/CryptoShell').then((m) => ({ default: m.CryptoShell })),
)
const FiatShell = lazy(() =>
  import('./components/wallet/FiatShell').then((m) => ({ default: m.FiatShell })),
)
const AdminDashboard = lazy(() =>
  import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
)

/** Bọc chunk lazy: vừa có boundary bắt lỗi, vừa có spinner lúc tải chunk. */
function LazyRoute({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <RouteBoundary>
      <Suspense fallback={<FullPageSpinner label={label ?? 'Đang tải...'} />}>{children}</Suspense>
    </RouteBoundary>
  );
}

function ProtectedRoute({ children, label }: { children: React.ReactNode; label?: string }) {
  const { session, loading } = useAuth();
  if (loading) return <FullPageSpinner label="Đang tải phiên đăng nhập..." />;
  if (!session) return <Navigate to="/login" />;
  return <LazyRoute label={label}>{children}</LazyRoute>;
}

/** Cổng riêng cho /admin: chỉ ADMIN được vào; USER bị đẩy về ví. */
function AdminLoginGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullPageSpinner label="Đang kiểm tra quyền truy cập..." />;
  if (!session) return <Navigate to="/login" />;
  if (session?.auth?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <LazyRoute label="Đang tải trang quản trị...">{children}</LazyRoute>;
}

/**
 * Điểm vào mặc định sau đăng nhập:
 * - ADMIN → thẳng vào trang Quản trị Hệ thống (không cần chọn loại ví).
 * - USER → chưa chọn loại ví thì về màn chọn; đã chọn thì vào đúng shell.
 */
function WalletEntry() {
  const { session, activeWalletMode } = useAuth();
  if (session?.auth?.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (activeWalletMode === 'fiat') return <Navigate to="/fiat" replace />;
  if (activeWalletMode === 'crypto') return <Navigate to="/crypto" replace />;
  return <Navigate to="/wallet-type" replace />;
}

/** Người đã đăng nhập không cần xem landing/login nữa — đẩy về ví. */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullPageSpinner label="Đang tải..." />;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <>
      <CommandPalette />

      <Routes>
        {/* Công khai */}
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/vnpay-return" element={<VnPayReturn />} />

        <Route path="/admin" element={
          <AdminLoginGate>
            <AdminDashboard />
          </AdminLoginGate>
        } />

        {/* Chọn loại ví */}
        <Route path="/wallet-type" element={
          <ProtectedRoute>
            <WalletTypeScreen />
          </ProtectedRoute>
        } />

        {/* Ví Fiat */}
        <Route path="/fiat" element={
          <ProtectedRoute label="Đang tải ví VND...">
            <FiatShell />
          </ProtectedRoute>
        } />

        {/* Ví Crypto */}
        <Route path="/crypto" element={
          <ProtectedRoute label="Đang tải ví crypto...">
            <CryptoShell />
          </ProtectedRoute>
        } />

        {/* Mặc định: chưa đăng nhập xem landing, đã đăng nhập vào ví */}
        <Route path="/" element={<RootEntry />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

/** Gốc "/" phục vụ cả khách và người đã đăng nhập. */
function RootEntry() {
  const { session, loading } = useAuth();
  if (loading) return <FullPageSpinner label="Đang tải..." />;
  if (!session) return <Landing />;
  return <RouteBoundary><WalletEntry /></RouteBoundary>;
}

export default App
