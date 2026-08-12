/** Chuyển thông báo thô từ Etherscan sang tiếng Việt dễ hiểu. */
export function formatExplorerError(message?: string): string {
  const raw = (message ?? '').trim();
  if (!raw || raw.toUpperCase() === 'NOTOK') {
    return 'Etherscan từ chối yêu cầu — kiểm tra địa chỉ ví (0x + 40 ký tự hex) và ETHERSCAN_API_KEY trên backend';
  }

  const lower = raw.toLowerCase();
  if (lower.includes('invalid address')) return 'Địa chỉ ví không hợp lệ';
  if (lower.includes('invalid api key') || lower.includes('missing/invalid api key')) {
    return 'API key Etherscan không hợp lệ — kiểm tra etherscan.api-key trên backend';
  }
  if (lower.includes('rate limit') || lower.includes('max rate')) {
    return 'Vượt giới hạn gọi API Etherscan — thử lại sau vài giây';
  }
  if (lower.includes('not supported for this chain') || lower.includes('free api access is not supported')) {
    return 'Gói API miễn phí chưa hỗ trợ mạng này — dùng Polygon/Ethereum hoặc thêm VITE_ALCHEMY_API_KEY';
  }
  if (lower.includes('no transactions') || lower.includes('no record found') || lower.includes('no tx found')) {
    return 'Không có giao dịch nào cho địa chỉ này';
  }
  if (lower.includes('từ chối yêu cầu')) {
    return 'Etherscan từ chối yêu cầu — restart backend và kiểm tra etherscan.api-key';
  }

  return raw;
}
