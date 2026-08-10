import { useCallback, useRef, useState } from 'react';
import { ethers } from 'ethers';
import { getSessionSeed, setSessionSeed, clearSessionSeed } from '../../../services/seedStore';
import { createOwnershipChallenge, verifyOwnership } from '../../../services/crypto';

/**
 * Mở khóa ví (nhập seed mỗi phiên) và cấp signer cho các luồng cần ký.
 *
 * Giữ nguyên hợp đồng cũ của CryptoShell:
 * - Seed chỉ nằm trong `seedStore` (sessionStorage + memory) — không gửi server,
 *   nhập một lần mỗi phiên tab rồi swap/gửi không hỏi lại.
 * - `resolveSignerFor` trả Promise; promise được resolve từ form nhập seed.
 *   Người dùng đóng modal → resolve(null) để luồng gọi tự dừng.
 */

export interface WalletUnlock {
  unlockOpen: boolean;
  unlockAddress: string;
  unlockSeed: string;
  setUnlockSeed: (value: string) => void;
  unlockError: string | null;
  unlockLoading: boolean;
  /** Lấy signer: dùng seed trong phiên, hoặc mở modal xin seed. */
  resolveSignerFor: (address: string, requiresOwnership?: boolean) => Promise<ethers.HDNodeWallet | null>;
  handleUnlockSubmit: (e: React.FormEvent) => Promise<void>;
  handleUnlockClose: () => void;
  /** true khi người dùng vừa hủy — luồng gọi kiểm tra rồi tự reset. */
  wasCanceled: () => boolean;
  consumeCanceled: () => void;
}

export function useWalletUnlock(): WalletUnlock {
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockAddress, setUnlockAddress] = useState('');
  const [unlockSeed, setUnlockSeed] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockLoading, setUnlockLoading] = useState(false);

  /** Resolve promise của resolveSignerFor từ trong form submit. */
  const unlockResolveRef = useRef<null | ((w: ethers.HDNodeWallet | null) => void)>(null);
  const pendingSignRef = useRef(false);
  const canceledRef = useRef(false);

  /** Xác minh quyền sở hữu với server (không gửi seed) sau khi mở khóa. */
  const confirmOwnership = useCallback(async (address: string, seed: string) => {
    try {
      const ch = await createOwnershipChallenge(address);
      const wallet = ethers.Wallet.fromPhrase(seed);
      const signature = wallet.signMessageSync(ch.message);
      await verifyOwnership({ address, message: ch.message, signature });
    } catch (err) {
      // Không chặn luồng chính — chỉ cảnh báo.
      console.warn('Chưa xác minh được quyền sở hữu với server:', err);
    }
  }, []);

  const resolveSignerFor = useCallback(
    async (address: string, requiresOwnership = false): Promise<ethers.HDNodeWallet | null> => {
      const seed = getSessionSeed(address);
      if (seed) {
        try {
          const w = ethers.Wallet.fromPhrase(seed);
          if (w.address.toLowerCase() === address.toLowerCase()) return w;
          clearSessionSeed(address);
        } catch {
          clearSessionSeed(address);
        }
      }
      // Chưa mở khóa → nhờ user nhập seed, resolve sau khi unlock.
      return new Promise<ethers.HDNodeWallet | null>((resolve) => {
        unlockResolveRef.current = resolve;
        pendingSignRef.current = requiresOwnership;
        canceledRef.current = false;
        setUnlockAddress(address);
        setUnlockSeed('');
        setUnlockError(null);
        setUnlockOpen(true);
      });
    },
    [],
  );

  const handleUnlockSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const phrase = unlockSeed.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
      if (!phrase || phrase.split(' ').length < 12) {
        setUnlockError('Vui lòng nhập đủ 12 từ seed phrase');
        return;
      }
      setUnlockLoading(true);
      setUnlockError(null);
      try {
        const wallet = ethers.Wallet.fromPhrase(phrase);
        if (wallet.address.toLowerCase() !== unlockAddress.toLowerCase()) {
          setUnlockError('Seed phrase không khớp với ví này. Kiểm tra lại 12 từ hoặc chọn đúng ví.');
          return;
        }
        setSessionSeed(unlockAddress, phrase);
        if (pendingSignRef.current) void confirmOwnership(unlockAddress, phrase);
        setUnlockOpen(false);
        unlockResolveRef.current?.(wallet);
        unlockResolveRef.current = null;
        setUnlockSeed('');
      } catch {
        setUnlockError('Seed phrase không hợp lệ (không phải BIP-39 hợp lệ)');
      } finally {
        setUnlockLoading(false);
      }
    },
    [confirmOwnership, unlockAddress, unlockSeed],
  );

  const handleUnlockClose = useCallback(() => {
    setUnlockOpen(false);
    canceledRef.current = true;
    unlockResolveRef.current?.(null);
    unlockResolveRef.current = null;
  }, []);

  return {
    unlockOpen,
    unlockAddress,
    unlockSeed,
    setUnlockSeed,
    unlockError,
    unlockLoading,
    resolveSignerFor,
    handleUnlockSubmit,
    handleUnlockClose,
    wasCanceled: () => canceledRef.current,
    consumeCanceled: () => {
      canceledRef.current = false;
    },
  };
}
