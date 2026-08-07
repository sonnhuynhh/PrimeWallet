import { request } from "./http";

export interface PaymentRequest {
  amount: number;
  description: string;
}

export interface PaymentResponse {
  paymentUrl: string;
  txnRef: string;
}

/**
 * Creates a VNPAY payment URL.
 */
export async function createPaymentUrl(amount: number, description: string): Promise<PaymentResponse> {
  return request<PaymentResponse>("/api/payment/vnpay/create", {
    method: "POST",
    body: JSON.stringify({ amount, description }),
  });
}

export async function processVnPayReturn(query: string) {
  return request(`/api/payment/vnpay/return${query}`);
}
