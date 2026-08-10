import { Icon } from '@iconify/react';
import { cn } from '@/lib/utils';
import { normalizeNetworkId, type NetworkId } from '@/lib/wagmi/chains';

/** Icon chain theo id mạng backend (Iconify / icons0.dev). */
const NETWORK_ICON: Record<NetworkId, string> = {
  eth_mainnet: 'cryptocurrency-color:eth',
  eth_sepolia: 'cryptocurrency-color:eth',
  bsc_mainnet: 'cryptocurrency-color:bnb',
  polygon_mainnet: 'cryptocurrency-color:matic',
  base_mainnet: 'token-branded:base',
};

interface NetworkIconProps {
  networkId: string;
  size?: number;
  className?: string;
}

export function NetworkIcon({ networkId, size = 20, className }: NetworkIconProps) {
  const id = normalizeNetworkId(networkId);
  const icon = NETWORK_ICON[id];

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-full bg-[--color-surface-2]',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon icon={icon} width={size} height={size} />
    </span>
  );
}
