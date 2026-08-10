import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ExternalLink, ImageOff, Images, Info } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { alchemyApiKey, etherscanApiKey } from '@/lib/env';
import { fetchNfts } from '@/lib/nft/nftService';
import { shortAddress } from '@/lib/utils';
import { useCrypto } from '../CryptoContext';

/** Tab "NFT" — bộ sưu tập ERC-721/1155 của ví đang chọn. */
export function NftTab() {
  const { data, address, explorerAddressUrl } = useCrypto();
  const { activeWallet } = data;

  const query = useQuery({
    queryKey: ['nfts', activeWallet?.blockchainNetwork, address],
    enabled: Boolean(activeWallet && address),
    staleTime: 60_000,
    queryFn: () =>
      fetchNfts({
        networkId: activeWallet!.blockchainNetwork,
        owner: address!,
        alchemyApiKey: alchemyApiKey(),
        etherscanApiKey: etherscanApiKey(),
      }),
  });

  if (!activeWallet) {
    return <Card className="py-10 text-center text-slate-400">Liên kết ví để xem NFT.</Card>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <Images className="h-5 w-5 text-[--color-primary]" /> Bộ sưu tập NFT
          </h3>
          {query.data?.kind === 'ok' ? (
            <Badge variant="default">
              {query.data.items.length} NFT · nguồn {query.data.source}
              {query.data.source === 'etherscan' && !alchemyApiKey() ? ' + on-chain' : ''}
            </Badge>
          ) : null}
        </div>

        {query.isPending ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
            ))}
          </div>
        ) : query.data?.kind === 'unavailable' ? (
          <div className="flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
            <div className="text-sm text-sky-200/90">
              <p className="font-semibold">Chưa liệt kê được NFT</p>
              <p className="mt-1 text-sky-200/70">{query.data.reason}</p>
            </div>
          </div>
        ) : query.data?.items.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white/5">
              <ImageOff className="h-7 w-7 text-slate-500" />
            </div>
            <p className="text-slate-400">Ví này chưa có NFT nào.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {query.data?.items.map((nft) => (
                <a
                  key={`${nft.contract}:${nft.tokenId}`}
                  href={explorerAddressUrl(nft.contract)}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-2xl border border-[--color-border] bg-white/[0.02] transition-colors hover:border-[--color-primary]/50"
                >
                  <div className="aspect-square w-full overflow-hidden bg-black/30">
                    {nft.imageUrl ? (
                      <img
                        src={nft.imageUrl}
                        alt={nft.name ?? `Token #${nft.tokenId}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center">
                        <span className="font-mono text-xs text-slate-600">
                          #{nft.tokenId.slice(0, 10)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-bold text-white">
                      {nft.name ?? `#${nft.tokenId}`}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {nft.collection ?? shortAddress(nft.contract)}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-[--color-primary]">
                      {nft.tokenType} <ExternalLink className="h-3 w-3" />
                    </p>
                  </div>
                </a>
              ))}
            </div>

            {query.data?.truncated ? (
              <p className="mt-4 text-center text-xs text-amber-400/80">
                Danh sách đã bị cắt ở trang đầu — ví này có thể còn NFT chưa hiển thị.
              </p>
            ) : null}

            {query.data?.source === 'etherscan' && !alchemyApiKey() ? (
              <p className="mt-4 text-center text-xs text-slate-500">
                Ảnh/tên lấy từ metadata on-chain. Để tải nhanh và đầy đủ hơn, thêm{' '}
                <code className="text-[--color-primary]">VITE_ALCHEMY_API_KEY</code> vào{' '}
                <code className="text-slate-400">.env.local</code> (miễn phí tại alchemy.com).
              </p>
            ) : null}
          </>
        )}
      </Card>
    </motion.div>
  );
}
