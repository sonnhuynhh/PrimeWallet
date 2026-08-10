import { request } from "./http";

export interface PaymentRequest {
  amount: number;
  description: string;
}

export interface PaymentResponse {
  paymentUrl: string;
  txnRef: string;
}

export interface PaymentConfirmResult {
  credited: boolean;
  alreadyProcessed: boolean;
  message: string;
}

export async function createPaymentUrl(amount: number, description: string): Promise<PaymentResponse> {
  return request<PaymentResponse>("/api/payment/vnpay/create", {
    method: "POST",
    body: JSON.stringify({ amount, description }),
  });
}

/** Xác nhận thanh toán VNPAY sau redirect — cộng tiền vào ví (idempotent). */
export async function confirmVnPayPayment(query: string): Promise<PaymentConfirmResult> {
  return request<PaymentConfirmResult>(`/api/payment/vnpay/confirm${query}`);
}
