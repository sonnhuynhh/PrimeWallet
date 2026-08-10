import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';
import { buildCandidates, encodePath, wrapNative } from './path';
import { computePoolAddress, midPriceScaled, priceImpactPct, sortTokens } from './pools';
import { applySlippage, execRateScaled, gasCostInTokenOut, scoreRoutes } from './score';
import { FEE_TIERS, NATIVE_SENTINEL, SEPOLIA_V3 } from './constants';

const WETH = SEPOLIA_V3.weth9;
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const;
const UNI = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' as const;

describe('encodePath', () => {
  it('đóng gói 1 hop thành 43 byte: token|fee(3)|token', () => {
    const path = encodePath([WETH, USDC], [3000]);
    expect(path.length).toBe(2 + 43 * 2);
    expect(path.toLowerCase()).toBe(
      `0x${WETH.slice(2)}000bb8${USDC.slice(2)}`.toLowerCase(),
    );
  });

  it('đóng gói 2 hop thành 66 byte', () => {
    const path = encodePath([USDC, WETH, UNI], [500, 3000]);
    expect(path.length).toBe(2 + 66 * 2);
    expect(path.slice(2 + 40, 2 + 46)).toBe('0001f4');
  });

  it('từ chối khi số fee không khớp số token', () => {
    expect(() => encodePath([WETH, USDC], [500, 3000])).toThrow();
  });
});

describe('wrapNative', () => {
  it('đổi sentinel native thành WETH', () => {
    expect(getAddress(wrapNative(NATIVE_SENTINEL))).toBe(getAddress(WETH));
  });

  it('giữ nguyên địa chỉ ERC-20', () => {
    expect(getAddress(wrapNative(USDC))).toBe(getAddress(USDC));
  });
});

describe('buildCandidates', () => {
  it('sinh 4 route 1-hop + 16 route 2-hop cho mỗi connector khả dụng', () => {
    // WETH→UNI: connector WETH bị loại (đã là token đầu), còn USDC → 4 + 16 = 20
    const routes = buildCandidates(WETH, UNI);
    expect(routes).toHaveLength(FEE_TIERS.length + FEE_TIERS.length ** 2);
  });

  it('phí LP dồn theo nhân, không phải cộng', () => {
    const routes = buildCandidates(WETH, UNI);
    const twoHop = routes.find((route) => route.fees.length === 2 && route.fees.every((f) => f === 3000));
    expect(twoHop).toBeDefined();
    // 1 − 0.997² = 0.005991, KHÔNG phải 0.006
    expect(twoHop!.cumulativeLpFeePct).toBeCloseTo(0.005991, 9);
  });

  it('trả rỗng khi hai token trùng nhau sau khi quy native', () => {
    expect(buildCandidates(NATIVE_SENTINEL, WETH)).toHaveLength(0);
  });
});

describe('computePoolAddress', () => {
  it('không phụ thuộc thứ tự token truyền vào', () => {
    expect(computePoolAddress(WETH, USDC, 3000)).toBe(computePoolAddress(USDC, WETH, 3000));
  });

  it('fee tier khác nhau cho pool khác nhau', () => {
    expect(computePoolAddress(WETH, USDC, 500)).not.toBe(computePoolAddress(WETH, USDC, 3000));
  });

  it('sortTokens đặt địa chỉ nhỏ hơn làm token0', () => {
    const [token0, token1] = sortTokens(UNI, USDC);
    expect(BigInt(token0) < BigInt(token1)).toBe(true);
  });
});

describe('midPriceScaled', () => {
  const SQRT_1_TO_1 = 1n << 96n; // √1 × 2^96 → tỷ giá raw 1:1

  it('cùng decimals, giá 1:1 → 1e18', () => {
    expect(midPriceScaled(SQRT_1_TO_1, true, 18, 18)).toBe(10n ** 18n);
  });

  it('hiệu chỉnh decimals khi bán 18-dec lấy 6-dec', () => {
    // raw 1:1 nhưng tokenOut ít hơn 12 chữ số → 1 tokenIn = 1e-12 tokenOut
    expect(midPriceScaled(SQRT_1_TO_1, true, 18, 6)).toBe(10n ** 30n);
  });

  it('đảo chiều khi tokenIn là token1', () => {
    const forward = midPriceScaled(SQRT_1_TO_1, true, 18, 18);
    const backward = midPriceScaled(SQRT_1_TO_1, false, 18, 18);
    expect(backward).toBe(forward);
  });

  it('trả 0 với sqrtPrice không hợp lệ', () => {
    expect(midPriceScaled(0n, true, 18, 18)).toBe(0n);
  });
});

describe('priceImpactPct', () => {
  const MID = 10n ** 18n;

  it('trừ phí LP để impact chỉ còn phần trượt giá', () => {
    // exec thấp hơn mid 0.5%, phí LP 0.3% → impact 0.2%
    const exec = (MID * 995n) / 1000n;
    expect(priceImpactPct(exec, MID, 0.003)).toBeCloseTo(0.002, 6);
  });

  it('floor ở 0 khi phí LP đã giải thích hết chênh lệch', () => {
    const exec = (MID * 997n) / 1000n;
    expect(priceImpactPct(exec, MID, 0.003)).toBe(0);
  });

  it('trả null khi thiếu mid price', () => {
    expect(priceImpactPct(MID, 0n, 0.003)).toBeNull();
  });
});

describe('applySlippage', () => {
  it('50 bps cắt đúng 0.5%', () => {
    expect(applySlippage(1_000_000n, 50)).toBe(995_000n);
  });

  it('0 bps giữ nguyên', () => {
    expect(applySlippage(1_000_000n, 0)).toBe(1_000_000n);
  });

  it('kẹp giá trị vượt ngưỡng', () => {
    expect(applySlippage(1_000_000n, 20_000)).toBe(0n);
  });
});

describe('execRateScaled', () => {
  it('quy đổi chéo decimals đúng', () => {
    // 1 WETH (1e18) → 2000 USDC (2000e6) ⇒ tỷ giá 2000e18
    const rate = execRateScaled(10n ** 18n, 2000n * 10n ** 6n, 18, 6);
    expect(rate).toBe(2000n * 10n ** 18n);
  });

  it('trả 0 khi amountIn = 0', () => {
    expect(execRateScaled(0n, 5n, 18, 18)).toBe(0n);
  });
});

describe('scoreRoutes — best execution', () => {
  const candidates = buildCandidates(WETH, UNI);

  function quote(index: number, amountOut: bigint, gasEstimate: bigint) {
    return { index, path: candidates[index].path, amountOut, gasEstimate };
  }

  it('chọn output ròng cao nhất, không phải amountOut cao nhất', () => {
    const oneHop = candidates.findIndex((route) => route.fees.length === 1);
    const twoHop = candidates.findIndex((route) => route.fees.length === 2);

    // Route 2 hop hơn 1 wei output nhưng tốn thêm rất nhiều gas → phải thua.
    const scored = scoreRoutes(
      candidates,
      [quote(oneHop, 1_000_000n, 100_000n), quote(twoHop, 1_000_001n, 300_000n)],
      { gasPriceWei: 1_000_000_000n, nativePerTokenOutScaled: 10n ** 18n },
    );

    expect(scored[0].quote.index).toBe(oneHop);
    expect(scored[0].netAmountOut).toBeLessThan(scored[0].quote.amountOut);
  });

  it('bỏ phần gas khi không quy đổi được tỷ giá', () => {
    const scored = scoreRoutes(candidates, [quote(0, 1_000n, 500_000n)], {
      gasPriceWei: 1_000_000_000n,
      nativePerTokenOutScaled: null,
    });
    expect(scored[0].gasCostInTokenOut).toBe(0n);
    expect(scored[0].netAmountOut).toBe(1_000n);
  });

  it('net bằng nhau thì ưu tiên route ít hop', () => {
    const oneHop = candidates.findIndex((route) => route.fees.length === 1);
    const twoHop = candidates.findIndex((route) => route.fees.length === 2);
    const scored = scoreRoutes(
      candidates,
      [quote(twoHop, 500n, 0n), quote(oneHop, 500n, 0n)],
      { gasPriceWei: 0n, nativePerTokenOutScaled: null },
    );
    expect(scored[0].candidate.fees).toHaveLength(1);
  });

  it('cộng overhead router 46k vào gas chấm điểm', () => {
    const scored = scoreRoutes(candidates, [quote(0, 10n ** 18n, 100_000n)], {
      gasPriceWei: 1n,
      nativePerTokenOutScaled: 10n ** 18n,
    });
    expect(scored[0].gasTotal).toBe(146_000n);
    expect(scored[0].gasCostInTokenOut).toBe(
      gasCostInTokenOut(146_000n, 1n, 10n ** 18n),
    );
  });
});
