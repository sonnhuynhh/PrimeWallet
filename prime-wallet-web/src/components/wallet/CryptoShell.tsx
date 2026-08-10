import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ethers } from 'ethers';
import type { Address } from 'viem';
import { useAccount, useConfig } from 'wagmi';
import {
  Coins, ArrowLeftRight, ArrowUpFromLine, QrCode, History, Images, BadgeCheck, Wallet,
  KeyRound, Loader2, Copy, Check, AlertTriangle, ShieldCheck, Landmark,
} from 'lucide-react';
import { WalletLayout } from './WalletLayout';
import { ConnectModal } from './ConnectModal';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { TabBar, type TabItem } from '../ui/TabBar';
import { WidgetBoundary } from '../error/Boundaries';
import { toastErr, toastOk } from '../feedback/toast';
import { cn } from '@/lib/utils';
import { useWalletBridge } from '@/lib/wagmi/WalletProvider';
import { chainIdOf } from '@/lib/wagmi/chains';
import { canUseWalletClient, sendWithWalletClient } from '@/lib/wagmi/sendTx';
import { useTransactionCenter } from '@/lib/tx/transactionCenter';
import { takeCryptoTabIntent, onCryptoTabIntent } from '@/lib/navIntent';
import { createOwnershipChallenge, linkCryptoWalletWithProof, recordTransaction } from '@/services/crypto';
import { getSessionSeed, setSessionSeed } from '@/services/seedStore';
import { useCryptoWalletData } from './crypto/useCryptoWalletData';
import { useWalletUnlock } from './crypto/useWalletUnlock';
import { useExternalWalletLink } from './crypto/useExternalWalletLink';
import { NetworkSwitcher } from './crypto/NetworkSwitcher';
import { CryptoContextProvider, type CryptoContextValue } from './crypto/CryptoContext';
import { AssetsTab } from './crypto/tabs/AssetsTab';
import { SwapTab } from './crypto/tabs/SwapTab';
import { SendTab } from './crypto/tabs/SendTab';
import { ReceiveTab } from './crypto/tabs/ReceiveTab';
import { HistoryTab } from './crypto/tabs/HistoryTab';
import { NftTab } from './crypto/tabs/NftTab';
import { AllowancesTab } from './crypto/tabs/AllowancesTab';
import { BridgeTab } from './crypto/tabs/BridgeTab';
import { WalletTab } from './crypto/tabs/WalletTab';
import type { TokenBalance } from '@/types/crypto';

/**
 * Ví Crypto — 8 tab, kiến trúc non-custodial giữ nguyên như trước:
 * seed phrase chỉ nằm trong bộ nhớ phiên, server chỉ biết địa chỉ công khai.
 *
 * Shell này chỉ còn làm 3 việc: dựng ngữ cảnh dùng chung cho các tab, điều
 * phối modal (tạo/liên kết ví, mở khoá, kết nối ví ngoài), và bắc cầu ví
 * in-app sang wagmi. Toàn bộ nghiệp vụ nằm trong tab tương ứng.
 */

type Tab = 'assets' | 'swap' | 'bridge' | 'send' | 'receive' | 'history' | 'nft' | 'allowances' | 'wallet';

const TABS: readonly TabItem<Tab>[] = [
  { id: 'assets', label: 'Tài sản', icon: Coins },
  { id: 'swap', label: 'Swap', icon: ArrowLeftRight },
  { id: 'bridge', label: 'Đổi VND', icon: Landmark },
  { id: 'send', label: 'Gửi', icon: ArrowUpFromLine },
  { id: 'receive', label: 'Nhận', icon: QrCode },
  { id: 'history', label: 'Lịch sử', icon: History },
  { id: 'nft', label: 'NFT', icon: Images },
  { id: 'allowances', label: 'Quyền', icon: BadgeCheck },
  { id: 'wallet', label: 'Ví', icon: Wallet },
];

/** Query nào cần làm mới khi một giao dịch hoàn tất. */
const TX_INVALIDATE_PREFIXES = [['allowances'], ['nfts'], ['swap-quote']];

export function CryptoShell() {
  const data = useCryptoWalletData();
  const unlock = useWalletUnlock();
  const bridge = useWalletBridge();
  const wagmiConfig = useConfig();
  const { address: wagmiAddress, isConnected } = useAccount();
  const txCenter = useTransactionCenter({ invalidatePrefixes: TX_INVALIDATE_PREFIXES });

  // Bảng lệnh ⌘K có thể yêu cầu mở sẵn một tab; ý định dùng một lần nên đọc
  // ngay trong initializer thay vì effect (tránh render nhấp một nhịp ở 'assets').
  const [tab, setTab] = useState<Tab>(() => takeCryptoTabIntent() ?? 'assets');
  const [connectOpen, setConnectOpen] = useState(false);

  // ===== Modal tạo / liên kết ví =====
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkMode, setLinkMode] = useState<'link' | 'create'>('create');
  const [linkNetwork, setLinkNetwork] = useState('');
  const [linkAddress, setLinkAddress] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [createdSeed, setCreatedSeed] = useState<string[]>([]);
  const [createdAddress, setCreatedAddress] = useState('');
  const [savedChecked, setSavedChecked] = useState(false);
  const [seedCopied, setSeedCopied] = useState(false);

  const { activeWallet, activeNetwork, networks, loadWallets, setActiveWalletId } = data;
  const chainId = activeWallet ? chainIdOf(activeWallet.blockchainNetwork) : undefined;
  const address = activeWallet?.walletAddress as Address | undefined;

  // Ví ngoài (OKX, MetaMask, WalletConnect…) kết nối qua wagmi chỉ tồn tại phía
  // trình duyệt — phải liên kết vào backend thì các tab mới thấy ví.
  useExternalWalletLink({
    wallets: data.wallets,
    loadWallets,
    setActiveWalletId,
    ready: !data.loading,
  });

  // Mặc định chọn mạng đầu tiên khi mở modal lần đầu.
  useEffect(() => {
    if (!linkNetwork && networks.length > 0) setLinkNetwork(networks[0].id);
  }, [linkNetwork, networks]);

  // Bảng lệnh gọi khi shell đã mount sẵn (người dùng đang ở /crypto).
  useEffect(() => onCryptoTabIntent(setTab), []);

  // ===== Bắc cầu ví in-app sang wagmi =====

  // Ví/mạng đang chọn đi qua ref trong WalletProvider nên connector luôn đọc
  // được giá trị mới mà không phải dựng lại config (dựng lại sẽ ngắt MetaMask).
  useEffect(() => {
    bridge.syncInApp({ address, chainId, rpcUrl: activeNetwork?.rpcUrl ?? undefined });
  }, [bridge, address, chainId, activeNetwork?.rpcUrl]);

  // Connector cần seed để ký; nó hỏi qua đây và ta mở đúng modal mở khoá cũ.
  const unlockRef = useRef(unlock);
  unlockRef.current = unlock;

  useEffect(() => {
    bridge.registerUnlockHandler(async (target: Address) => {
      const cached = getSessionSeed(target);
      if (cached) return cached;
      const signer = await unlockRef.current.resolveSignerFor(target);
      if (!signer) return null;
      return getSessionSeed(target);
    });
  }, [bridge]);

  // ===== Hành vi dùng chung cho các tab =====

  const explorerBase = activeNetwork?.explorerUrl ?? '';
  const explorerTxUrl = useCallback(
    (hash: string) => (explorerBase ? `${explorerBase}/tx/${hash}` : '#'),
    [explorerBase],
  );
  const explorerAddressUrl = useCallback(
    (value: string) => (explorerBase ? `${explorerBase}/address/${value}` : '#'),
    [explorerBase],
  );

  const requireSigner = useCallback(async () => {
    if (!activeWallet) return null;
    return unlock.resolveSignerFor(activeWallet.walletAddress);
  }, [activeWallet, unlock]);

  const [pendingSendToken, setPendingSendToken] = useState<TokenBalance | null>(null);
  const openSend = useCallback((token: TokenBalance | null) => {
    setPendingSendToken(token);
    setTab('send');
  }, []);

  const openLink = useCallback((mode: 'link' | 'create') => {
    setLinkMode(mode);
    setCreateStep(1);
    setCreatedSeed([]);
    setCreatedAddress('');
    setLinkAddress('');
    setLinkLabel('');
    setSavedChecked(false);
    setSeedCopied(false);
    setLinkOpen(true);
  }, []);

  /**
   * Ký + phát một giao dịch thô (swap, revoke allowance…).
   * Sau khi phát thành công, ghi lịch sử in-app để tab Lịch sử hiển thị.
   */
  const signAndSend = useCallback<CryptoContextValue['signAndSend']>(
    async ({ to, data: calldata, value, gasLimit, summary }) => {
      if (!activeWallet || !chainId) return null;

      let hash: Address;

      if (canUseWalletClient(isConnected, wagmiAddress, activeWallet.walletAddress)) {
        hash = await sendWithWalletClient(wagmiConfig, {
          to,
          data: calldata,
          value,
          gas: gasLimit,
        });
      } else {
        const signer = await unlock.resolveSignerFor(activeWallet.walletAddress);
        if (!signer) return null;

        const provider = new ethers.JsonRpcProvider(activeNetwork?.rpcUrl);
        const connected = signer.connect(provider);
        const request = await connected.populateTransaction({
          to,
          data: calldata,
          value: value ?? 0n,
          ...(gasLimit ? { gasLimit } : {}),
        });
        const response = await connected.sendTransaction(request);
        hash = response.hash as Address;
      }

      txCenter.track({ chainId, hash, summary });

      const txType = summary.toLowerCase().includes('swap')
        ? 'SWAP'
        : summary.toLowerCase().includes('thu hồi')
          ? 'REVOKE'
          : 'CONTRACT';

      void recordTransaction({
        blockchainNetwork: activeWallet.blockchainNetwork,
        transactionHash: hash,
        fromAddress: activeWallet.walletAddress,
        toAddress: to,
        amount: '0',
        symbol: activeNetwork?.nativeSymbol ?? 'ETH',
        type: txType,
        description: summary,
      }).catch((err) => console.warn('Ghi lịch sử in-app thất bại:', err));

      return hash;
    },
    [
      activeWallet, activeNetwork?.nativeSymbol, activeNetwork?.rpcUrl, chainId,
      isConnected, txCenter, unlock, wagmiAddress, wagmiConfig,
    ],
  );

  const ctx = useMemo<CryptoContextValue>(
    () => ({
      data,
      unlock,
      txCenter,
      chainId,
      address,
      explorerTxUrl,
      explorerAddressUrl,
      openSend,
      signAndSend,
      requireSigner,
      openLink,
      usesWalletClient: canUseWalletClient(isConnected, wagmiAddress, activeWallet?.walletAddress),
      wagmiConfig,
    }),
    [
      data, unlock, txCenter, chainId, address, explorerTxUrl, explorerAddressUrl,
      openSend, signAndSend, requireSigner, openLink, isConnected, wagmiAddress,
      activeWallet?.walletAddress, wagmiConfig,
    ],
  );

  // ===== Tạo ví mới =====

  /** Bước 1: sinh seed phrase + địa chỉ, hiển thị đúng một lần để người dùng chép tay. */
  const handleCreateStart = (event: React.FormEvent) => {
    event.preventDefault();
    if (!linkNetwork) {
      toastErr('Vui lòng chọn mạng blockchain');
      return;
    }
    try {
      setLinkLoading(true);
      const wallet = ethers.Wallet.createRandom();
      setCreatedSeed(wallet.mnemonic!.phrase.split(' '));
      setCreatedAddress(wallet.address);
      setLinkAddress(wallet.address);
      setSavedChecked(false);
      setSeedCopied(false);
      setCreateStep(2);
    } catch (error) {
      toastErr(error, 'Không tạo được ví');
    } finally {
      setLinkLoading(false);
    }
  };

  /** Bước 2: đã sao lưu seed → liên kết ví kèm bằng chứng sở hữu (server chỉ nhận địa chỉ + chữ ký). */
  const handleCreateConfirm = async () => {
    if (!createdAddress || !linkNetwork) return;
    try {
      setLinkLoading(true);
      const seed = createdSeed.join(' ');
      const challenge = await createOwnershipChallenge(createdAddress);
      const signature = ethers.Wallet.fromPhrase(seed).signMessageSync(challenge.message);
      const saved = await linkCryptoWalletWithProof({
        walletAddress: createdAddress,
        blockchainNetwork: linkNetwork,
        label: linkLabel.trim() || undefined,
        message: challenge.message,
        signature,
      });

      // Giữ seed trong bộ nhớ phiên để ký được ngay, mất khi đóng tab.
      setSessionSeed(createdAddress, seed);
      await loadWallets();
      if (saved?.id) setActiveWalletId(saved.id);

      toastOk('Đã tạo và liên kết ví', 'Nhớ giữ seed phrase ở nơi an toàn.');
      setLinkOpen(false);
      setCreatedSeed([]);
      setCreatedAddress('');
      setLinkLabel('');
    } catch (error) {
      toastErr(error, 'Không liên kết được ví');
    } finally {
      setLinkLoading(false);
    }
  };

  /** Liên kết ví có sẵn: bắt buộc ký challenge để chứng minh sở hữu. */
  const handleLinkExisting = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = linkAddress.trim();
    if (!ethers.isAddress(target) || !linkNetwork) {
      toastErr('Vui lòng nhập địa chỉ hợp lệ và chọn mạng');
      return;
    }
    try {
      setLinkLoading(true);
      const signer = await unlock.resolveSignerFor(target, true);
      if (unlock.wasCanceled()) {
        unlock.consumeCanceled();
        return;
      }
      if (!signer) return;

      const challenge = await createOwnershipChallenge(target);
      const signature = signer.signMessageSync(challenge.message);
      await linkCryptoWalletWithProof({
        walletAddress: target,
        blockchainNetwork: linkNetwork,
        label: linkLabel.trim() || undefined,
        message: challenge.message,
        signature,
      });

      await loadWallets();
      toastOk('Đã liên kết ví');
      setLinkOpen(false);
      setLinkAddress('');
      setLinkLabel('');
    } catch (error) {
      toastErr(error, 'Không liên kết được ví');
    } finally {
      setLinkLoading(false);
    }
  };

  const copySeed = async () => {
    await navigator.clipboard.writeText(createdSeed.join(' '));
    setSeedCopied(true);
    toastOk('Đã copy seed phrase', 'Dán vào trình quản lý mật khẩu rồi xoá khỏi clipboard.');
  };

  const tabsWithBadge = useMemo(
    () =>
      TABS.map((item) =>
        item.id === 'history' && txCenter.pendingCount > 0
          ? { ...item, badge: txCenter.pendingCount }
          : item,
      ),
    [txCenter.pendingCount],
  );

  return (
    <CryptoContextProvider value={ctx}>
      <WalletLayout
        accent="violet"
        title="Ví Crypto"
        subtitle="Ví non-custodial — khoá riêng tư của bạn không bao giờ rời khỏi trình duyệt."
      >
        {/* Mobile: mạng một hàng riêng; tab cuộn ngang icon-only.
            Desktop: tab + network cùng một hàng, tab chiếm phần còn lại. */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex justify-end sm:order-2 sm:shrink-0">
            <NetworkSwitcher />
          </div>
          <TabBar
            tabs={tabsWithBadge}
            value={tab}
            onChange={setTab}
            className="min-w-0 flex-1 sm:order-1"
          />
        </div>

        {data.error ? (
          <Card className="mb-6 flex items-start gap-3 border-amber-500/30 bg-amber-500/10">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-200/90">{data.error}</p>
          </Card>
        ) : null}

        {/* Boundary theo tab: lỗi một tab không kéo sập cả ví, đổi tab là hồi phục. */}
        <WidgetBoundary label={`crypto:${tab}`} resetKey={tab}>
          {tab === 'assets' ? <AssetsTab /> : null}
          {tab === 'swap' ? <SwapTab /> : null}
          {tab === 'bridge' ? <BridgeTab /> : null}
          {tab === 'send' ? <SendTab initialToken={pendingSendToken} /> : null}
          {tab === 'receive' ? <ReceiveTab /> : null}
          {tab === 'history' ? <HistoryTab /> : null}
          {tab === 'nft' ? <NftTab /> : null}
          {tab === 'allowances' ? <AllowancesTab /> : null}
          {tab === 'wallet' ? <WalletTab onConnectExternal={() => setConnectOpen(true)} /> : null}
        </WidgetBoundary>
      </WalletLayout>

      <ConnectModal isOpen={connectOpen} onClose={() => setConnectOpen(false)} />

      {/* ===== Modal tạo / liên kết ví ===== */}
      <Modal
        isOpen={linkOpen}
        onClose={() => setLinkOpen(false)}
        title={linkMode === 'create' ? 'Tạo ví mới' : 'Liên kết ví có sẵn'}
        size="lg"
      >
        <div className="mb-5 flex gap-1.5 rounded-full border border-[--color-border] bg-[--color-surface-2] p-1.5">
          {(['create', 'link'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setLinkMode(mode);
                setCreateStep(1);
              }}
              className={cn(
                'flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                linkMode === mode
                  ? 'bg-[--color-primary-soft] text-white ring-1 ring-[--color-primary]/30'
                  : 'text-[--color-muted-foreground] hover:text-slate-200',
              )}
            >
              {mode === 'create' ? 'Tạo ví mới' : 'Ví có sẵn'}
            </button>
          ))}
        </div>

        {linkMode === 'create' && createStep === 2 ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <p className="text-sm text-amber-200/90">
                12 từ này là <b>cách duy nhất</b> khôi phục ví. Chép ra giấy hoặc lưu vào trình quản
                lý mật khẩu. PrimeWallet không giữ bản sao — mất seed là mất ví vĩnh viễn.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-3xl border border-[--color-border] bg-[--color-surface-2] p-4 sm:grid-cols-3">
              {createdSeed.map((word, index) => (
                <div
                  key={`${word}-${index}`}
                  className="flex items-center gap-2 rounded-xl bg-[--color-surface-3] px-3 py-2"
                >
                  <span className="w-5 text-right text-xs font-semibold text-[--color-muted-foreground]">
                    {index + 1}
                  </span>
                  <span className="font-mono text-sm font-semibold text-white">{word}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button fullWidth={false} variant="secondary" onClick={() => void copySeed()}>
                {seedCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {seedCopied ? 'Đã copy' : 'Copy seed phrase'}
              </Button>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[--color-border] bg-[--color-surface-2] p-4">
              <input
                type="checkbox"
                checked={savedChecked}
                onChange={(event) => setSavedChecked(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[--color-primary]"
              />
              <span className="text-sm text-slate-300">
                Tôi đã sao lưu 12 từ này ở nơi an toàn và hiểu rằng không ai khôi phục được nếu mất.
              </span>
            </label>

            <div className="rounded-2xl border border-[--color-border] bg-[--color-surface-2] p-4">
              <p className="text-xs uppercase tracking-wide text-[--color-muted-foreground]">Địa chỉ ví</p>
              <p className="mt-1 break-all font-mono text-sm text-white">{createdAddress}</p>
            </div>

            <Button
              loading={linkLoading}
              disabled={!savedChecked}
              onClick={() => void handleCreateConfirm()}
            >
              <ShieldCheck className="h-4 w-4" /> Hoàn tất & liên kết ví
            </Button>
          </div>
        ) : (
          <form
            onSubmit={linkMode === 'create' ? handleCreateStart : handleLinkExisting}
            className="space-y-4"
          >
            {linkMode === 'link' ? (
              <Input
                label="Địa chỉ ví"
                placeholder="0x…"
                value={linkAddress}
                onChange={(event) => setLinkAddress(event.target.value)}
                hint="Bạn sẽ phải nhập seed phrase để ký xác minh — seed không rời trình duyệt."
              />
            ) : null}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-300">
                Mạng blockchain
              </label>
              <select
                value={linkNetwork}
                onChange={(event) => setLinkNetwork(event.target.value)}
                className="w-full rounded-2xl border border-[--color-input] bg-[--color-surface-2] px-4 py-3 text-white outline-none transition-colors focus:border-[--color-primary] focus:ring-2 focus:ring-[--color-ring]/40"
              >
                {networks.map((network) => (
                  <option key={network.id} value={network.id} className="bg-[--color-surface-1]">
                    {network.label}
                    {network.testnet ? ' (testnet)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Nhãn ví (tuỳ chọn)"
              placeholder="Ví chính, Ví tiết kiệm…"
              value={linkLabel}
              onChange={(event) => setLinkLabel(event.target.value)}
            />

            <Button type="submit" loading={linkLoading}>
              {linkMode === 'create' ? 'Tạo ví & xem seed phrase' : 'Ký xác minh & liên kết'}
            </Button>
          </form>
        )}
      </Modal>

      {/* ===== Modal mở khoá ví ===== */}
      <Modal
        isOpen={unlock.unlockOpen}
        onClose={unlock.handleUnlockClose}
        title="Mở khoá ví"
        size="md"
      >
        <form onSubmit={(event) => void unlock.handleUnlockSubmit(event)} className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-[--color-border] bg-[--color-surface-2] p-4">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-[--color-primary]" />
            <div className="min-w-0">
              <p className="text-sm text-slate-300">
                Nhập 12 từ seed phrase để ký giao dịch trong phiên này.
              </p>
              <p className="mt-1 break-all font-mono text-xs text-[--color-muted-foreground]">
                {unlock.unlockAddress}
              </p>
            </div>
          </div>

          <textarea
            value={unlock.unlockSeed}
            onChange={(event) => unlock.setUnlockSeed(event.target.value)}
            rows={3}
            autoFocus
            placeholder="word1 word2 word3 …"
            className="w-full resize-none rounded-xl border border-[--color-input] bg-black/30 px-4 py-3 font-mono text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-[--color-primary] focus:ring-2 focus:ring-[--color-ring]/40"
          />

          {unlock.unlockError ? (
            <p className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {unlock.unlockError}
            </p>
          ) : null}

          <Badge variant="outline" className="w-full justify-center py-2">
            Seed chỉ nằm trong bộ nhớ tab này — đóng tab là xoá sạch.
          </Badge>

          <Button type="submit" loading={unlock.unlockLoading}>
            {unlock.unlockLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Mở khoá
          </Button>
        </form>
      </Modal>
    </CryptoContextProvider>
  );
}
