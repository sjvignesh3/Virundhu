import { Injectable } from "@nestjs/common";
import type {
  ChargeRequest,
  ChargeResult,
  IPaymentProvider,
} from "../payment-provider.interface";

/**
 * Phase 2 stand-in. Always succeeds. Replaced by RazorpayPaymentProvider
 * in Phase 3 without touching OrderService.
 */
@Injectable()
export class SimulatedPaymentProvider implements IPaymentProvider {
  async charge(request: ChargeRequest): Promise<ChargeResult> {
    return {
      provider: "SIMULATED",
      providerPaymentId: `sim_${request.orderId.slice(0, 8)}_${Date.now()}`,
      method: request.method ?? "SIMULATED",
      status: "PAID",
    };
  }
}
