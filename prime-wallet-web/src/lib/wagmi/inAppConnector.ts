import { createConnector, type CreateConnectorFn } from 'wagmi';
import {
  getAddress,
  type Address,
  type EIP1193Provider,
  type Hex,
  SwitchChainError,
  UserRejectedRequestError,
  createWalletClient,
  http,
} from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { getSessionSeed, isSessionUnlocked, clearSessionSeed } from '@/services/seedStore';
import { SUPPORTED_CHAINS, chainIdOf, networkIdOf } from './chains';
import { getPublicClient } from './clients';

/**
 * Connector tuỳ biến bọc ví in-app (seed phrase chỉ lưu ở module-scope).
 *
 * Ràng buộc:
 * - Seed phrase KHÔNG rời trình duyệt — không localStorage, không gửi server.
 * - Mỗi phiên user phải nhập lại seed (unlock modal) — tương đương "unlock ví".
 * - Connector vẫn phải expose EIP-1193 provider để wagmi/viem hoạt động bình thường.
 *
 * Cách hoạt động:
 * - `connect()`: lấy seed từ `seedStore` (đã unlock qua UI) → tạo account.
 * - `eth_sendTransaction` / `personal_sign` / `eth_signTypedData_v4`: ký bằng viem account.
 * - `disconnect()`: xoá seed khỏi sessionSeeds.
 */

interface InAppConnectorParams {
  /** Địa chỉ ví đang active — truyền từ UI context. */
  address: () => Address | undefined;
  /** Mạng đang active — truyền từ UI context. */
  chainId: () => number | undefined;
  /** Callback khi connector cần unlock (hiển thị modal yêu cầu seed). */
  onUnlockRequired: (address: Address) => Promise<string | null>;
  /** RPC đang dùng (từ backend `/networks`); bỏ trống thì viem dùng RPC mặc định của chain. */
  rpcUrl?: () => string | undefined;
}

/**
 * Dẫn xuất account từ seed phrase theo đường dẫn BIP-44 mặc định (m/44'/60'/0'/0/0)
 * — cùng đường dẫn `ethers.Wallet.fromPhrase` đang dùng, nên địa chỉ khớp với
 * các ví đã liên kết trước đây.
 */
function seedAccount(seed: string) {
  return mnemonicToAccount(seed, { addressIndex: 0 });
}

/**
 * Lấy seed đang mở khoá, hoặc yêu cầu UI mở khoá.
 *
 * Seed chỉ đi từ `seedStore` (module-scope Map) tới đây rồi vào `mnemonicToAccount`.
 * Không log, không lưu, không truyền ra ngoài hàm gọi.
 */
async function requireSeed(
  address: Address,
  onUnlockRequired: InAppConnectorParams['onUnlockRequired'],
): Promise<string> {
  const existing = getSessionSeed(address);
  if (existing) return existing;

  const unlocked = await onUnlockRequired(address);
  if (!unlocked) {
    throw new UserRejectedRequestError(new Error('Người dùng từ chối mở khoá ví'));
  }
  return unlocked;
}

export function inAppConnector(params: InAppConnectorParams): CreateConnectorFn {
  return createConnector((config) => ({
    id: 'in-app-wallet',
    name: 'Ví trong ứng dụng',
    type: 'inApp' as const,

    async setup() {
      // Không có gì cần khởi động — seedStore đã sống trong module scope.
    },

    async connect({ chainId } = {}) {
      const address = params.address();
      if (!address) throw new Error('Không có ví nào được chọn trong ứng dụng');

      // Chưa mở khoá → nhờ UI hiện modal nhập seed
      const seed = await requireSeed(address, params.onUnlockRequired);
      const account = seedAccount(seed);
      if (account.address.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Seed phrase không khớp với địa chỉ ví đã chọn');
      }

      const activeChainId = chainId ?? params.chainId() ?? chainIdOf('eth_sepolia');

      return {
        accounts: [address] as readonly Address[],
        chainId: activeChainId,
      } as never;
    },

    async disconnect() {
      const address = params.address();
      if (address) clearSessionSeed(address);
    },

    async getAccounts() {
      const address = params.address();
      if (!address || !isSessionUnlocked(address)) return [];
      return [address];
    },

    async getChainId() {
      return params.chainId() ?? chainIdOf('eth_sepolia');
    },

    async isAuthorized() {
      const address = params.address();
      return !!(address && isSessionUnlocked(address));
    },

    async switchChain({ chainId }) {
      // In-app wallet hỗ trợ tất cả chain được khai báo — UI sẽ đổi `activeNetwork`.
      // Connector không tự đổi state UI, chỉ báo rằng chain hợp lệ.
      const found = SUPPORTED_CHAINS.find((c) => c.id === chainId);
      if (!found) {
        throw new SwitchChainError(new Error(`Mạng ${chainId} không được hỗ trợ`));
      }
      return found;
    },

    onAccountsChanged(accounts) {
      if (accounts.length === 0) {
        config.emitter.emit('disconnect');
      } else {
        config.emitter.emit('change', { accounts: accounts.map(getAddress) });
      }
    },

    onChainChanged(chainId) {
      config.emitter.emit('change', { chainId: Number(chainId) });
    },

    onDisconnect() {
      config.emitter.emit('disconnect');
    },

    async getProvider() {
      // Trả EIP-1193 provider — cần cho wagmi hook `useWalletClient`.
      return createInAppProvider(params);
    },
  }));
}

/** EIP-1193 provider giả — xử lý `eth_sendTransaction`, `personal_sign`, `eth_signTypedData_v4`. */
function createInAppProvider(params: InAppConnectorParams): EIP1193Provider {
  const request = async ({
    method,
    params: requestParams,
  }: {
    method: string;
    params?: unknown;
  }): Promise<unknown> => {
    const address = params.address();
    const chainId = params.chainId() ?? chainIdOf('eth_sepolia');

    switch (method) {
        case 'eth_accounts': {
          if (!address || !isSessionUnlocked(address)) return [];
          return [address];
        }

        case 'eth_chainId': {
          return `0x${chainId.toString(16)}`;
        }

        case 'eth_requestAccounts': {
          if (!address) throw new Error('Không có ví nào được chọn');
          await requireSeed(address, params.onUnlockRequired);
          return [address];
        }

        case 'personal_sign': {
          if (!address) throw new Error('Không có ví nào được chọn');
          const [messageHex, from] = requestParams as [Hex, Address];
          if (from.toLowerCase() !== address.toLowerCase()) {
            throw new Error('Địa chỉ ký không khớp với ví đang active');
          }

          const seed = await requireSeed(address, params.onUnlockRequired);
          const account = seedAccount(seed);
          return account.signMessage({ message: { raw: messageHex } });
        }

        case 'eth_signTypedData_v4': {
          if (!address) throw new Error('Không có ví nào được chọn');
          const [from, typedDataJson] = requestParams as [Address, string];
          if (from.toLowerCase() !== address.toLowerCase()) {
            throw new Error('Địa chỉ ký không khớp với ví đang active');
          }

          const seed = await requireSeed(address, params.onUnlockRequired);
          const account = seedAccount(seed);
          const typedData = JSON.parse(typedDataJson);
          return account.signTypedData(typedData);
        }

        case 'eth_sendTransaction': {
          if (!address) throw new Error('Không có ví nào được chọn');
          const [txRequest] = requestParams as [Record<string, unknown>];

          const seed = await requireSeed(address, params.onUnlockRequired);
          const account = seedAccount(seed);
          const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
          if (!chain) throw new Error(`Chain ${chainId} không hỗ trợ`);

          const client = createWalletClient({
            account,
            chain,
            transport: http(params.rpcUrl?.() ?? undefined),
          });

          // viem tự điền nonce/gas/fee còn thiếu rồi ký cục bộ trước khi gửi.
          return client.sendTransaction(txRequest as never);
        }

        case 'wallet_switchEthereumChain': {
          const [{ chainId: requestChainId }] = requestParams as [{ chainId: string }];
          const targetChainId = parseInt(requestChainId, 16);
          const found = SUPPORTED_CHAINS.find((c) => c.id === targetChainId);
          if (!found) {
            throw new SwitchChainError(new Error(`Mạng ${targetChainId} không hỗ trợ`));
          }
          // UI sẽ tự cập nhật chainId qua event `onChainChanged` (không xử lý ở đây).
          return null;
        }

        default: {
          // Mọi method CHỈ ĐỌC (eth_call, eth_getBalance, eth_estimateGas, ...)
          // chuyển thẳng cho RPC — provider này chỉ đặc biệt ở phần KÝ.
          const client = getPublicClient(networkIdOf(chainId), params.rpcUrl?.());
          return client.request({ method, params: requestParams } as never);
        }
      }
    };

  return {
    request,
    // EIP-1193 yêu cầu `on` / `removeListener`; ví in-app không phát event thật
    // (UI tự quản activeWallet/activeNetwork) nên chỉ cần no-op.
    on: () => {},
    removeListener: () => {},
  } as unknown as EIP1193Provider;
}
