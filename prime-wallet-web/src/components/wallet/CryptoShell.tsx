import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  Plus, ArrowDownToLine, ArrowUpFromLine, History, Trash2,
  Wallet, Bitcoin, Copy, CheckCircle2, ShieldCheck, Loader2, RefreshCcw,
  ExternalLink, Wifi, WifiOff
} from 'lucide-react';
import { WalletLayout } from './WalletLayout';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { ethers } from 'ethers';
import {
  getSupportedNetworks, getLinkedWallets, getWalletBalance, linkCryptoWallet,
  unlinkCryptoWallet, estimateGas, sendTransaction, getWalletHistory,
  getInAppTransactions, createOwnershipChallenge, verifyOwnership,
} from '../../services/crypto';
import type {
  NetworkInfo, CryptoWalletInfo, WalletBalanceData, TokenBalance, EstimateGasData,
  EtherscanTransaction, InAppTransaction,
} from '../../types/crypto';

type Tab = 'overview' | 'history' | 'security';

/**
 * Ví Crypto — giao diện riêng cho tài sản Web3 (non-custodial).
 * Tính năng: đa mạng, liên kết/tạo/import ví, số dư native + ERC-20,
 * gửi với preview gas, nhận QR, lịch sử on-chain + in-app, xác minh quyền sở hữu.
 */
export function CryptoShell() {
  const [tab, setTab] = useState<Tab>('overview');

  // ===== Data =====
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [wallets, setWallets] = useState<CryptoWalletInfo[]>([]);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
  const [balance, setBalance] = useState<WalletBalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ===== Modals =====
  const [linkOpen, setLinkOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);

  // ===== Link/create =====
  const [linkAddress, setLinkAddress] = useState('');
  const [linkNetwork, setLinkNetwork] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkMode, setLinkMode] = useState<'link' | 'create'>('link');
  const [linkLoading, setLinkLoading] = useState(false);

  // ===== Send =====
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendToken, setSendToken] = useState<TokenBalance | null>(null);
  const [sendGas, setSendGas] = useState<EstimateGasData | null>(null);
  const [sendGasLoading, setSendGasLoading] = useState(false);
  const [sendSending, setSendSending] = useState(false);

  // ===== History =====
  const [history, setHistory] = useState<EtherscanTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [inAppTxs, setInAppTxs] = useState<InAppTransaction[]>([]);
  const [inAppLoading, setInAppLoading] = useState(false);
  const [historyMode, setHistoryMode] = useState<'onchain' | 'inapp'>('onchain');

  // ===== Security =====
  const [challenge, setChallenge] = useState<string>(''); // message cần ký
  const [sigAddress, setSigAddress] = useState('');
  const [sig, setSig] = useState('');
  const [verifyResult, setVerifyResult] = useState<null | boolean>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeWallet = wallets.find((w) => w.id === activeWalletId) ?? null;
  const activeNetwork = networks.find((n) => n.id === activeWallet?.blockchainNetwork) ?? null;

  // ===== Loaders =====
  const loadNetworks = useCallback(async () => {
    try {
      const data = await getSupportedNetworks();
      setNetworks(data);
    } catch (e: any) {
      console.warn('Không tải được mạng', e);
    }
  }, []);

  const loadWallets = useCallback(async () => {
    try {
      const data = await getLinkedWallets();
      setWallets(data);
      // Giữ ví đang chọn nếu còn tồn tại, ngược lại chọn ví primary đầu tiên
      setActiveWalletId((prev) => {
        if (prev && data.some((w) => w.id === prev)) return prev;
        return data.find((w) => w.primary)?.id ?? data[0]?.id ?? null;
      });
      return data;
    } catch (e: any) {
      console.warn('Không tải được ví', e);
      return [];
    }
  }, []);

  const loadBalance = useCallback(async () => {
    if (!activeWalletId) return;
    try {
      setRefreshing(true);
      const data = await getWalletBalance(activeWalletId);
      setBalance(data);
    } catch (e: any) {
      setError('Không tải được số dư ví: ' + e.message);
    } finally {
      setRefreshing(false);
    }
  }, [activeWalletId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadNetworks(), loadWallets()]);
      setLoading(false);
    })();
  }, [loadNetworks, loadWallets]);

  useEffect(() => {
    if (activeWalletId) loadBalance();
  }, [activeWalletId, loadBalance]);

  // ===== History loaders =====
  useEffect(() => {
    if (tab === 'history' && activeWalletId) {
      if (historyMode === 'onchain') {
        setHistoryLoading(true);
        getWalletHistory(activeWalletId)
          .then((res) => setHistory(res.result ?? []))
          .catch(() => setHistory([]))
          .finally(() => setHistoryLoading(false));
      } else {
        setInAppLoading(true);
        getInAppTransactions(activeWalletId)
          .then((page) => setInAppTxs(page.content))
          .catch(() => setInAppTxs([]))
          .finally(() => setInAppLoading(false));
      }
    }
  }, [tab, historyMode, activeWalletId]);

  // ===== Link / Create =====
  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLinkLoading(true);
      if (linkMode === 'create') {
        // Tạo ví mới — người dùng tự nắm private key (lưu cục bộ cho demo; cảnh báo trong thực tế)
        const w = ethers.Wallet.createRandom();
        localStorage.setItem(`prime_pk_${w.address.toLowerCase()}`, w.privateKey);
        setLinkAddress(w.address);
        alert(`Đã tạo ví mới!\nĐịa chỉ: ${w.address}\n\nPrivate key đã lưu trong trình duyệt (chỉ dùng cho demo).\nHãy sao lưu an toàn!`);
      }
      if (!linkAddress.trim() || !linkNetwork) {
        alert('Vui lòng nhập địa chỉ và chọn mạng');
        return;
      }
      await linkCryptoWallet({
        walletAddress: linkAddress.trim(),
        blockchainNetwork: linkNetwork,
        label: linkLabel.trim() || undefined,
      });
      await loadWallets();
      setLinkOpen(false);
      setLinkAddress(''); setLinkLabel('');
    } catch (err: any) {
      alert('Lỗi liên kết ví: ' + err.message);
    } finally {
      setLinkLoading(false);
    }
  };

  const handleUnlink = async (id: string) => {
    if (!confirm('Xóa ví này khỏi tài khoản? (Tài sản on-chain không bị ảnh hưởng)')) return;
    try {
      await unlinkCryptoWallet(id);
      await loadWallets();
      if (activeWalletId === id) setActiveWalletId(null);
    } catch (err: any) {
      alert('Lỗi xóa ví: ' + err.message);
    }
  };

  // ===== Send =====
  const openSend = async (token: TokenBalance | null) => {
    setSendToken(token);
    setSendTo(''); setSendAmount(''); setSendGas(null);
    setSendOpen(true);
  };

  const loadGasPreview = async () => {
    if (!activeWallet || !sendTo || !sendAmount) return;
    setSendGasLoading(true);
    setSendGas(null);
    try {
      const isNative = !sendToken?.contractAddress;
      const data = await estimateGas({
        blockchainNetwork: activeWallet.blockchainNetwork,
        fromAddress: activeWallet.walletAddress,
        toAddress: sendTo,
        amount: sendAmount,
        tokenAddress: isNative ? undefined : sendToken!.contractAddress,
      });
      setSendGas(data);
    } catch (err: any) {
      setSendGas(null);
      alert('Không ước tính được gas: ' + err.message);
    } finally {
      setSendGasLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet) return;
    try {
      setSendSending(true);
      const isNative = !sendToken?.contractAddress;

      // 1. Kiểm tra số dư
      if (isNative) {
        const bal = parseFloat(balance?.balanceEth ?? '0');
        if (parseFloat(sendAmount) > bal) throw new Error('Số dư không đủ!');
      }

      // 2. Lấy private key cục bộ (non-custodial — backend không giữ key)
      const pk = localStorage.getItem(`prime_pk_${activeWallet.walletAddress.toLowerCase()}`);
      if (!pk) {
        // Cho phép người dùng nhập private key tạm thời để ký
        const entered = prompt('Ví này chưa có private key trong trình duyệt.\nNhập private key để ký giao dịch (chỉ lưu trong session này):');
        if (!entered) throw new Error('Bạn đã hủy ký giao dịch');
        // eslint-disable-next-line no-alert
        signAndBroadcast(entered.trim());
        return;
      }
      signAndBroadcast(pk);
    } catch (err: any) {
      alert('Lỗi gửi: ' + err.message);
    } finally {
      setSendSending(false);
    }
  };

  const signAndBroadcast = async (pk: string) => {
    if (!activeWallet || !sendTo || !sendAmount) return;
    try {
      // 3. Lấy RPC URL từ mạng
      const rpcUrl = getRpcUrlFor(activeWallet.blockchainNetwork);
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(pk, provider);

      // 4. Chuẩn bị giao dịch
      let tx;
      if (!sendToken?.contractAddress) {
        // Native transfer
        tx = await wallet.populateTransaction({
          to: sendTo,
          value: ethers.parseEther(sendAmount),
        });
      } else {
        // ERC-20 transfer
        const erc20 = new ethers.Contract(
          sendToken.contractAddress,
          ['function transfer(address to, uint256 value) returns (bool)'],
          wallet
        );
        const decimals = sendToken.decimals ?? 18;
        const rawAmount = ethers.parseUnits(sendAmount, decimals);
        tx = await erc20.transfer.populateTransaction(sendTo, rawAmount);
      }

      // 5. Ký offline
      const signedTx = await wallet.signTransaction(tx);

      // 6. Broadcast qua backend + lưu lịch sử in-app
      const res = await sendTransaction({
        blockchainNetwork: activeWallet.blockchainNetwork,
        signedTransactionHex: signedTx,
        fromAddress: activeWallet.walletAddress,
        toAddress: sendTo,
        amount: sendAmount,
        symbol: sendToken?.symbol ?? activeNetwork?.nativeSymbol ?? 'ETH',
        tokenAddress: sendToken?.contractAddress,
      });

      alert(`Giao dịch thành công!\nTX: ${res.transactionHash}`);
      setSendOpen(false);
      setSendTo(''); setSendAmount(''); setSendGas(null);
      loadBalance();
    } catch (err: any) {
      alert('Lỗi ký/broadcast: ' + err.message);
    } finally {
      setSendSending(false);
    }
  };

  // ===== Receive =====
  const copyAddress = async () => {
    if (!activeWallet) return;
    try {
      await navigator.clipboard.writeText(activeWallet.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  // ===== Ownership verify =====
  const handleVerifyOpen = async () => {
    if (!activeWallet) return;
    setVerifyResult(null); setSig('');
    setSigAddress(activeWallet.walletAddress);
    try {
      const ch = await createOwnershipChallenge(activeWallet.walletAddress);
      setChallenge(ch.message);
    } catch (err: any) {
      alert('Lỗi tạo challenge: ' + err.message);
    }
    setVerifyOpen(true);
  };

  const handleSign = async () => {
    try {
      const pk = localStorage.getItem(`prime_pk_${sigAddress.toLowerCase()}`);
      if (!pk) throw new Error('Không tìm thấy private key cho ví này. Hãy nhập qua bước tạo/import.');
      const wallet = new ethers.Wallet(pk);
      const signature = wallet.signMessageSync(challenge);
      setSig(signature);
      await handleVerify(signature);
    } catch (err: any) {
      alert('Lỗi ký: ' + err.message);
    }
  };

  const handleVerify = async (signature?: string) => {
    if (!sigAddress || !challenge) return;
    setVerifyLoading(true);
    try {
      const sigToUse = signature ?? sig;
      if (!sigToUse) throw new Error('Chưa có chữ ký');
      const result = await verifyOwnership({
        address: sigAddress,
        message: challenge,
        signature: sigToUse,
      });
      setVerifyResult(result.verified);
    } catch (err: any) {
      alert('Lỗi xác minh: ' + err.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  // ===== Helpers =====
  const fmtNum = (n: number | string | undefined, decimals = 4) => {
    const v = Number(n ?? 0);
    return v.toLocaleString('en-US', { maximumFractionDigits: decimals });
  };

  const tokenRows: (TokenBalance & { isNative?: boolean })[] = balance
    ? [
        {
          symbol: balance.nativeSymbol,
          name: balance.networkLabel || 'Native coin',
          decimals: 18,
          balance: balance.balanceEth,
          isNative: true,
        },
        ...(balance.tokens ?? []),
      ]
    : [];

  const shortAddr = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

  const explorerUrl = (hash: string) =>
    activeNetwork?.explorerUrl
      ? `${activeNetwork.explorerUrl}/tx/${hash}`
      : `https://etherscan.io/tx/${hash}`;

  const tabs = [
    { id: 'overview' as const, label: 'Tài sản', icon: Wallet },
    { id: 'history' as const, label: 'Lịch sử', icon: History },
    { id: 'security' as const, label: 'Bảo mật', icon: ShieldCheck },
  ];

  if (loading) {
    return (
      <WalletLayout accent="violet" title="Ví Crypto" subtitle="Tài sản Web3 của bạn">
        <div className="flex items-center justify-center py-24 text-violet-400">
          <Loader2 className="w-8 h-8 animate-spin mr-3" /> Đang tải ví Crypto...
        </div>
      </WalletLayout>
    );
  }

  return (
    <WalletLayout accent="violet" title="Ví Crypto (Web3)" subtitle="Tài sản số phi tập trung — bạn nắm chìa khóa của mình">
      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              tab === t.id
                ? 'bg-violet-500/15 border border-violet-500/40 text-violet-400'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <motion.div key="overview" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* ===== Wallet selector / no wallet ===== */}
          {wallets.length === 0 ? (
            <Card className="border-violet-500/20 text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/15 flex items-center justify-center mx-auto mb-4">
                <Bitcoin className="w-8 h-8 text-violet-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Chưa có ví Crypto</h3>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                Liên kết ví có sẵn (MetaMask...) hoặc tạo ví mới. Bạn nắm giữ private key, PrimeWallet chỉ lưu địa chỉ công khai.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => { setLinkMode('link'); setLinkOpen(true); }} title="Liên kết ví có sẵn" className="w-auto px-6 bg-violet-600 hover:bg-violet-500 text-white" />
                <Button onClick={() => { setLinkMode('create'); setLinkOpen(true); }} title="Tạo ví mới" className="w-auto bg-slate-800 hover:bg-slate-700 text-violet-400 border border-violet-500/30" />
              </div>
            </Card>
          ) : (
            <>
              {/* Wallet picker */}
              <div className="flex flex-wrap gap-2 mb-2">
                {wallets.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setActiveWalletId(w.id)}
                    className={`group flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all ${
                      activeWalletId === w.id
                        ? 'bg-violet-500/15 border-violet-500/50 text-violet-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-violet-500/30'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span>{w.label || networks.find((n) => n.id === w.blockchainNetwork)?.nativeSymbol || w.blockchainNetwork}</span>
                    {w.primary && <span className="text-[10px] uppercase bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded">Chính</span>}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUnlink(w.id); }}
                      className="ml-1 p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Xóa ví"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </button>
                ))}
                <button
                  onClick={() => { setLinkMode('link'); setLinkOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-violet-500/40 text-violet-400 font-bold text-sm hover:bg-violet-500/10 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Liên kết thêm
                </button>
              </div>

              {/* Balance card */}
              <Card className="border-violet-500/20 relative overflow-hidden">
                <div className="absolute -top-16 -right-16 w-72 h-72 bg-violet-500/10 blur-3xl rounded-full" />
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-semibold mb-2 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-violet-400" />
                        Số dư ví · {activeNetwork?.label ?? activeWallet?.blockchainNetwork}
                        {activeNetwork?.testnet && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase">Testnet</span>}
                      </p>
                      <div className="flex items-baseline gap-2">
                        <h1 className="text-5xl font-black text-white">
                          {fmtNum(balance?.balanceEth, 6)}
                        </h1>
                        <span className="text-2xl text-violet-400 font-bold">{balance?.nativeSymbol || activeNetwork?.nativeSymbol}</span>
                      </div>
                    </div>
                    <button
                      onClick={loadBalance}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-violet-400 hover:bg-slate-800 transition-colors"
                      title="Làm mới"
                    >
                      <RefreshCcw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {error && <p className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-3">{error}</p>}

                  {activeWallet && (
                    <div className="mt-4 flex items-center gap-3 bg-slate-900/80 border border-slate-800 rounded-xl p-3">
                      <p className="text-xs text-slate-500 font-mono break-all flex-1">{activeWallet.walletAddress}</p>
                      <button onClick={copyAddress} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title="Sao chép địa chỉ">
                        {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}

                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <Button
                      onClick={() => openSend(null)}
                      title="Gửi (Native)"
                      className="flex-1 bg-violet-600 hover:bg-violet-500 text-white"
                    />
                    <Button
                      onClick={() => setReceiveOpen(true)}
                      title="Nhận"
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-violet-300 border border-slate-700"
                    />
                    <Button
                      onClick={() => { setLinkMode('link'); setLinkOpen(true); }}
                      title="Liên kết Ví"
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                    />
                  </div>
                </div>
              </Card>

              {/* Token list */}
              <Card className="border-violet-500/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                    <Bitcoin className="w-5 h-5 text-violet-400" /> Token & Coin
                  </h3>
                  <p className="text-xs text-slate-500">{tokenRows.length} tài sản</p>
                </div>
                <div className="space-y-2">
                  {tokenRows.map((t) => (
                    <div key={t.symbol + (t.contractAddress ?? 'native')} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-violet-500/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.isNative ? 'bg-violet-500/15' : 'bg-slate-800'}`}>
                          <span className="font-black text-violet-300 text-sm">{t.symbol?.slice(0, 2)}</span>
                        </div>
                        <div>
                          <p className="font-bold text-white">{t.symbol} {t.isNative && <span className="text-[10px] text-violet-400 font-bold">NATIVE</span>}</p>
                          <p className="text-xs text-slate-500">{t.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-white">{fmtNum(t.balance, 6)}</p>
                          <p className="text-xs text-slate-500">{t.contractAddress ? shortAddr(t.contractAddress) : ''}</p>
                        </div>
                        {!t.isNative && (
                          <button
                            onClick={() => openSend(t)}
                            className="p-2 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors"
                            title={`Gửi ${t.symbol}`}
                          >
                            <ArrowUpFromLine className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </motion.div>
      )}

      {tab === 'history' && (
        <motion.div key="history" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {!activeWallet ? (
            <Card className="text-center text-slate-400 py-10">Liên kết ví để xem lịch sử giao dịch.</Card>
          ) : (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                  <History className="w-5 h-5 text-violet-400" /> Lịch sử giao dịch
                </h3>
                <div className="flex gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
                  <button
                    onClick={() => setHistoryMode('onchain')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${historyMode === 'onchain' ? 'bg-violet-500/20 text-violet-300' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    On-chain
                  </button>
                  <button
                    onClick={() => setHistoryMode('inapp')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${historyMode === 'inapp' ? 'bg-violet-500/20 text-violet-300' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Trong ứng dụng
                  </button>
                </div>
              </div>

              {historyMode === 'onchain' ? (
                historyLoading ? (
                  <p className="text-center text-slate-400 py-8">Đang tải từ {activeNetwork?.label ?? 'explorer'}...</p>
                ) : history.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Chưa có giao dịch on-chain nào.</p>
                ) : (
                  <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                    {history.map((tx) => {
                      const isReceive = tx.to.toLowerCase() === activeWallet.walletAddress.toLowerCase();
                      const ethValue = ethers.formatEther(BigInt(tx.value || '0'));
                      return (
                        <div key={tx.hash} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isReceive ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                              {isReceive ? <ArrowDownToLine className="w-5 h-5 text-emerald-400" /> : <ArrowUpFromLine className="w-5 h-5 text-red-400" />}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white">
                                {isReceive ? 'Nhận' : 'Gửi'} {ethValue} {activeNetwork?.nativeSymbol}
                              </p>
                              <p className="text-xs text-slate-500">
                                {isReceive ? `Từ ${shortAddr(tx.from)}` : `Đến ${shortAddr(tx.to)}`} · {new Date(Number(tx.timeStamp) * 1000).toLocaleString('vi-VN')}
                              </p>
                              <a href={explorerUrl(tx.hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-400 hover:underline mt-0.5">
                                Xem trên explorer <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                          <p className={`font-black shrink-0 ${isReceive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isReceive ? '+' : '-'}{fmtNum(ethValue, 6)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                inAppLoading ? (
                  <p className="text-center text-slate-400 py-8">Đang tải giao dịch trong ứng dụng...</p>
                ) : inAppTxs.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Chưa có giao dịch nào thực hiện qua ứng dụng.</p>
                ) : (
                  <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                    {inAppTxs.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tx.status === 'SUCCESS' || tx.status === 'CONFIRMED' ? 'bg-emerald-500/15' : tx.status === 'FAILED' ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
                            {tx.status === 'SUCCESS' || tx.status === 'CONFIRMED' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : tx.status === 'FAILED' ? <WifiOff className="w-5 h-5 text-red-400" /> : <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white">
                              Gửi {fmtNum(tx.amount, 6)} {tx.symbol}
                            </p>
                            <p className="text-xs text-slate-500">
                              Đến {shortAddr(tx.toAddress)} · {new Date(tx.createdAt).toLocaleString('vi-VN')}
                            </p>
                            {tx.txHash && (
                              <a href={explorerUrl(tx.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-400 hover:underline mt-0.5">
                                {shortAddr(tx.txHash)} <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-red-400">-{fmtNum(tx.amount, 6)} {tx.symbol}</p>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${tx.status === 'SUCCESS' || tx.status === 'CONFIRMED' ? 'bg-emerald-500/15 text-emerald-400' : tx.status === 'FAILED' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </Card>
          )}
        </motion.div>
      )}

      {tab === 'security' && (
        <motion.div key="security" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card className="border-violet-500/10">
            <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-2">
              <ShieldCheck className="w-5 h-5 text-violet-400" /> Xác minh quyền sở hữu ví
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Ký một message bằng private key của bạn để chứng minh bạn là chủ sở hữu địa chỉ ví này.
            </p>
            <Button onClick={handleVerifyOpen} title="Xác minh quyền sở hữu" className="w-auto px-6 bg-violet-600 hover:bg-violet-500 text-white" />
          </Card>

          <Card className="border-violet-500/10">
            <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-2">
              <Wifi className="w-5 h-5 text-violet-400" /> Tổng quan bảo mật
            </h3>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Private key</p>
                <p className="font-bold text-emerald-400">Chỉ bạn giữ — không bao giờ gửi lên server</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Kiến trúc</p>
                <p className="font-bold text-white">Non-custodial — PrimeWallet chỉ lưu địa chỉ công khai</p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ===== Link modal ===== */}
      <Modal isOpen={linkOpen} onClose={() => setLinkOpen(false)} title={linkMode === 'create' ? 'Tạo ví Crypto mới' : 'Liên kết ví có sẵn'}>
        <form onSubmit={handleLink} className="space-y-6">
          <div className="flex gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button type="button" onClick={() => setLinkMode('link')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${linkMode === 'link' ? 'bg-violet-500/20 text-violet-300' : 'text-slate-400 hover:text-slate-200'}`}>
              Liên kết
            </button>
            <button type="button" onClick={() => setLinkMode('create')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${linkMode === 'create' ? 'bg-violet-500/20 text-violet-300' : 'text-slate-400 hover:text-slate-200'}`}>
              Tạo mới
            </button>
          </div>

          {linkMode === 'create' ? (
            <p className="text-sm text-slate-400 bg-violet-500/10 border border-violet-500/30 rounded-xl p-3">
              Tạo ví mới: private key sẽ được sinh và lưu cục bộ trong trình duyệt (chỉ dùng cho demo).
              Trong sản phẩm thật, hãy dùng ví cứng / MetaMask.
            </p>
          ) : (
            <Input
              label="Địa chỉ ví (0x...)"
              value={linkAddress}
              onChange={(e) => setLinkAddress(e.target.value)}
              placeholder="0x..."
              pattern="^0x[a-fA-F0-9]{40}$"
              required
            />
          )}

          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Mạng blockchain</label>
            <select
              value={linkNetwork}
              onChange={(e) => setLinkNetwork(e.target.value)}
              className="w-full bg-slate-900 p-4 rounded-xl border border-slate-700 text-white outline-none focus:border-violet-500"
              required
            >
              <option value="">Chọn mạng...</option>
              {networks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label} ({n.nativeSymbol}) {n.testnet ? '· Testnet' : ''}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Tên ví (tùy chọn)"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="VD: Ví chính, Ví tiết kiệm"
            maxLength={60}
          />

          <Button type="submit" title={linkMode === 'create' ? 'Tạo & Liên kết' : 'Liên kết ví'} loading={linkLoading} className="bg-violet-600 hover:bg-violet-500 text-white" />
        </form>
      </Modal>

      {/* ===== Send modal ===== */}
      <Modal isOpen={sendOpen} onClose={() => setSendOpen(false)} title={`Gửi ${sendToken?.symbol ?? balance?.nativeSymbol ?? ''}`}>
        <form onSubmit={handleSend} className="space-y-6">
          <Input
            label="Địa chỉ ví nhận (0x...)"
            value={sendTo}
            onChange={(e) => setSendTo(e.target.value)}
            placeholder="0x..."
            pattern="^0x[a-fA-F0-9]{40}$"
            required
          />
          <Input
            label={`Số lượng (${sendToken?.symbol ?? balance?.nativeSymbol ?? ''})`}
            value={sendAmount}
            onChange={(e) => setSendAmount(e.target.value)}
            type="number"
            step="any"
            placeholder="0.01"
            required
          />
          {sendToken?.contractAddress ? (
            <p className="text-xs text-slate-500">Token: {sendToken.symbol} ({sendToken.name})</p>
          ) : (
            <p className="text-xs text-slate-500">Token: Native coin ({balance?.nativeSymbol})</p>
          )}

          {/* Gas preview */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phí giao dịch (gas)</p>
              <button type="button" onClick={loadGasPreview} className="flex items-center gap-1 text-xs font-bold text-violet-400 hover:text-violet-300" disabled={sendGasLoading}>
                {sendGasLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                Ước tính
              </button>
            </div>
            {sendGas ? (
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Giá gas</span><span className="text-slate-200 font-mono">{fmtNum(sendGas.gasPriceWei, 0)} wei</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Gas limit</span><span className="text-slate-200 font-mono">{fmtNum(sendGas.gasLimit, 0)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Tổng phí</span><span className="font-bold text-violet-300">{fmtNum(sendGas.totalFeeEth, 8)} {sendGas.nativeSymbol}</span></div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Nhập địa chỉ và số lượng rồi bấm "Ước tính" để xem phí trước khi gửi.</p>
            )}
          </div>

          <Button type="submit" title="Ký & Gửi" loading={sendSending} className="bg-violet-600 hover:bg-violet-500 text-white" />
          <p className="text-[11px] text-slate-600 text-center">
            Giao dịch được ký offline bằng private key của bạn — backend chỉ broadcast.
          </p>
        </form>
      </Modal>

      {/* ===== Receive modal ===== */}
      <Modal isOpen={receiveOpen} onClose={() => setReceiveOpen(false)} title="Nhận Crypto">
        {activeWallet ? (
          <div className="space-y-6 text-center">
            <div className="inline-flex p-4 rounded-2xl bg-white">
              <QRCodeSVG value={activeWallet.walletAddress} size={200} />
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-2">Quét QR hoặc sao chép địa chỉ để nhận tiền</p>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-3">
                <p className="text-xs font-mono text-slate-300 break-all flex-1">{activeWallet.walletAddress}</p>
                <button onClick={copyAddress} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title="Sao chép">
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Chỉ gửi {activeNetwork?.nativeSymbol} hoặc token trên mạng {activeNetwork?.label}. Gửi sai mạng sẽ mất tiền!
            </p>
          </div>
        ) : (
          <p className="text-slate-400 text-center py-6">Vui lòng liên kết ví trước.</p>
        )}
      </Modal>

      {/* ===== Verify modal ===== */}
      <Modal isOpen={verifyOpen} onClose={() => setVerifyOpen(false)} title="Xác minh quyền sở hữu">
        <div className="space-y-6">
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message cần ký</p>
            <p className="text-sm font-mono text-slate-300 break-all">{challenge || 'Đang tạo challenge...'}</p>
          </div>
          <Button onClick={handleSign} title="Ký bằng private key" loading={verifyLoading} className="bg-violet-600 hover:bg-violet-500 text-white" />
          {verifyResult !== null && (
            <div className={`rounded-xl p-4 flex items-center gap-2 font-bold ${verifyResult ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
              {verifyResult ? <CheckCircle2 className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              {verifyResult ? 'Bạn là chủ sở hữu ví!' : 'Chữ ký không khớp với địa chỉ ví.'}
            </div>
          )}
        </div>
      </Modal>
    </WalletLayout>
  );
}

/** Lấy RPC URL cho mạng — fallback cho các mạng testnet phổ biến. */
function getRpcUrlFor(networkId: string): string {
  const map: Record<string, string> = {
    eth_sepolia: 'https://rpc2.sepolia.org',
    eth_mainnet: 'https://eth.llamarpc.com',
    bsc_testnet: 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
    polygon_amoy: 'https://rpc-amoy.polygon.technology',
  };
  return map[networkId] ?? 'https://rpc2.sepolia.org';
}