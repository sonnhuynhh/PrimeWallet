import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { WalletProvider } from './lib/wagmi/WalletProvider'
import { Toaster } from './components/feedback/toast'
import { GlobalBoundary } from './components/error/Boundaries'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalBoundary>
      <BrowserRouter>
        <AuthProvider>
          <WalletProvider>
            <App />
            <Toaster />
          </WalletProvider>
        </AuthProvider>
      </BrowserRouter>
    </GlobalBoundary>
  </StrictMode>,
)
