import React from 'react';
import { Command } from 'cmdk';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, Coins, Repeat, Send, QrCode, History, Image as ImageIcon,
  ShieldOff, KeyRound, LogOut, ShieldAlert, Search, ArrowLeftRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { setCryptoTabIntent, type CryptoTabId } from '@/lib/navIntent';

/**
 * Bảng lệnh ⌘K / Ctrl+K — điều hướng nhanh không cần chuột.
 *
 * `/` cũng mở được, nhưng bị bỏ qua khi con trỏ đang ở trong input/textarea
 * (nếu không thì không ai gõ được dấu "/" vào form).
 */

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Wallet;
  group: string;
  run: () => void;
  /** Ẩn lệnh khi không đủ điều kiện (VD lệnh quản trị với người dùng thường). */
  visible?: boolean;
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const { session, signOut, setActiveWalletMode } = useAuth();

  const isAdmin = session?.auth?.role === 'ADMIN';

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const cmdK = e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey);

      // "/" chỉ mở palette khi người dùng không đang gõ vào một ô nhập.
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      const slash = e.key === '/' && !typing;

      if (cmdK || slash) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const go = React.useCallback(
    (fn: () => void) => () => {
      setOpen(false);
      fn();
    },
    [],
  );

  const openCryptoTab = React.useCallback(
    (tab: CryptoTabId) => () => {
      setCryptoTabIntent(tab);
      setActiveWalletMode('crypto');
      navigate('/crypto');
    },
    [navigate, setActiveWalletMode],
  );

  const items: CommandItem[] = [
    {
      id: 'fiat', group: 'Ví', label: 'Ví Fiat (VND)', hint: 'Nạp, chuyển, hoá đơn',
      icon: Wallet, run: () => { setActiveWalletMode('fiat'); navigate('/fiat'); },
    },
    {
      id: 'crypto', group: 'Ví', label: 'Ví Crypto', hint: 'Tài sản on-chain',
      icon: Coins, run: () => { setActiveWalletMode('crypto'); navigate('/crypto'); },
    },
    {
      id: 'switch', group: 'Ví', label: 'Đổi loại ví', icon: ArrowLeftRight,
      run: () => navigate('/wallet-type'),
    },

    { id: 'assets', group: 'Crypto', label: 'Tài sản', icon: Coins, run: openCryptoTab('assets') },
    { id: 'swap', group: 'Crypto', label: 'Swap token', hint: 'Uniswap V3 / LI.FI', icon: Repeat, run: openCryptoTab('swap') },
    { id: 'send', group: 'Crypto', label: 'Gửi token', icon: Send, run: openCryptoTab('send') },
    { id: 'receive', group: 'Crypto', label: 'Nhận / mã QR', icon: QrCode, run: openCryptoTab('receive') },
    { id: 'history', group: 'Crypto', label: 'Lịch sử on-chain', icon: History, run: openCryptoTab('history') },
    { id: 'nft', group: 'Crypto', label: 'Bộ sưu tập NFT', icon: ImageIcon, run: openCryptoTab('nft') },
    { id: 'allowances', group: 'Crypto', label: 'Quyền chi tiêu', hint: 'Thu hồi approval', icon: ShieldOff, run: openCryptoTab('allowances') },
    { id: 'wallets', group: 'Crypto', label: 'Quản lý ví', hint: 'Tạo / liên kết / mở khoá', icon: KeyRound, run: openCryptoTab('wallet') },

    {
      id: 'admin', group: 'Hệ thống', label: 'Trang quản trị', icon: ShieldAlert,
      run: () => navigate('/admin'), visible: isAdmin,
    },
    { id: 'signout', group: 'Hệ thống', label: 'Đăng xuất', icon: LogOut, run: signOut },
  ];

  const groups = React.useMemo(() => {
    const visible = items.filter((it) => it.visible !== false);
    const order: string[] = [];
    const map = new Map<string, CommandItem[]>();
    for (const it of visible) {
      if (!map.has(it.group)) { map.set(it.group, []); order.push(it.group); }
      map.get(it.group)!.push(it);
    }
    return order.map((name) => ({ name, items: map.get(name)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, navigate, setActiveWalletMode, signOut, openCryptoTab]);

  // Chỉ hiện cho người đã đăng nhập — landing/login không có gì để điều hướng.
  if (!session) return null;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild aria-label="Bảng lệnh">
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -8 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="fixed left-1/2 top-[18vh] z-50 w-[min(92vw,36rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-[--color-border] bg-[--color-popover] shadow-2xl"
              >
                <Dialog.Title className="sr-only">Bảng lệnh điều hướng</Dialog.Title>

                <Command loop>
                  <div className="flex items-center gap-3 border-b border-[--color-border] px-4">
                    <Search className="h-4 w-4 shrink-0 text-slate-500" />
                    <Command.Input
                      autoFocus
                      placeholder="Tìm lệnh hoặc trang..."
                      className="w-full bg-transparent py-4 text-white outline-none placeholder:text-slate-600"
                    />
                    <kbd className="hidden shrink-0 rounded border border-[--color-border] px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 sm:block">
                      ESC
                    </kbd>
                  </div>

                  <Command.List className="max-h-[min(24rem,50vh)] overflow-y-auto p-2">
                    <Command.Empty className="py-8 text-center text-sm text-slate-500">
                      Không có lệnh nào khớp.
                    </Command.Empty>

                    {groups.map((group) => (
                      <Command.Group
                        key={group.name}
                        heading={group.name}
                        className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-bold **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:text-slate-500"
                      >
                        {group.items.map((item) => (
                          <Command.Item
                            key={item.id}
                            value={`${item.label} ${item.hint ?? ''}`}
                            onSelect={go(item.run)}
                            className="flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm text-slate-300 aria-selected:bg-[--color-primary-soft] aria-selected:text-white"
                          >
                            <item.icon className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="font-semibold">{item.label}</span>
                            {item.hint ? (
                              <span className="ml-auto truncate text-xs text-slate-500">{item.hint}</span>
                            ) : null}
                          </Command.Item>
                        ))}
                      </Command.Group>
                    ))}
                  </Command.List>
                </Command>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
