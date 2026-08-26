import type { PaymentMethod, PaymentProvider, PaymentStatus } from "@virundhu/shared";

export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");

export interface ChargeRequest {
  orderId: string;
  amount: number;
  method?: PaymentMethod;
}

export interface ChargeResult {
  provider: PaymentProvider;
  providerPaymentId: string | null;
  method: PaymentMethod;
  status: PaymentStatus;
}

/**
 * Payment gateway abstraction. `RazorpayPaymentProvider` (Phase 3) implements
 * this same shape without touching OrderService.
 */
export interface IPaymentProvider {
  charge(request: ChargeRequest): Promise<ChargeResult>;
}
