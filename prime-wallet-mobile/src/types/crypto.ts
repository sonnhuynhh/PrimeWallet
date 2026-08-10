export interface TokenBalance {
  contractAddress?: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  isNative?: boolean;
}

export interface EstimateGasData {
  gasLimit: string;
  gasPriceWei: string;
  totalFeeWei: string;
  totalFeeEth: string;
  nativeSymbol: string;
}

export interface InAppTransaction {
  id: string;
  type: string;
  txHash?: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  symbol: string;
  tokenAddress?: string;
  status: string;
  description?: string;
  createdAt: string;
}
