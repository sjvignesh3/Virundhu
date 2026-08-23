/**
 * Payment abstraction.
 *
 * Phase 1: `SimulatedPaymentService` returns PAID immediately. Phase 2 swaps
 * in Razorpay/UPI without touching callers.
 */

import type { PaymentMethod, PaymentStatus } from "@/lib/domain/types";

export interface PaymentResult {
  status: PaymentStatus;
  method: PaymentMethod;
  reference?: string;
}

export interface PaymentService {
  charge(amount: number): Promise<PaymentResult>;
}

export class SimulatedPaymentService implements PaymentService {
  async charge(amount: number): Promise<PaymentResult> {
    // Small artificial delay so the UI has time to show a spinner —
    // gives customers the "I paid" feedback loop instead of an instant flash.
    await new Promise((r) => setTimeout(r, 400));
    if (!Number.isFinite(amount) || amount < 0) {
      return { status: "FAILED", method: "SIMULATED" };
    }
    return {
      status: "PAID",
      method: "SIMULATED",
      reference: `SIM-${Date.now().toString(36).toUpperCase()}`,
    };
  }
}

export const paymentService: PaymentService = new SimulatedPaymentService();
