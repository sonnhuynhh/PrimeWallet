import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Ghép class Tailwind, class sau ghi đè class trước khi cùng nhóm thuộc tính. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Rút gọn địa chỉ ví: 0x1234…abcd */
export function shortAddress(address?: string | null, head = 6, tail = 4) {
  if (!address) return ''
  if (address.length <= head + tail + 1) return address
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}

/** Định dạng số theo locale Việt Nam. */
export function fmtNumber(value: number | string, maximumFractionDigits = 6) {
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('vi-VN', { maximumFractionDigits })
}

/** Định dạng tiền VND. */
export function fmtVnd(value: number | string) {
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return '0 ₫'
  return `${n.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫`
}

/** Cắt số thập phân về đúng `decimals` chữ số (tránh lỗi parseUnits). */
export function clampDecimals(value: string, decimals: number) {
  const [int, frac] = value.split('.')
  if (frac === undefined) return int
  if (decimals === 0) return int
  return `${int}.${frac.slice(0, decimals)}`
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
