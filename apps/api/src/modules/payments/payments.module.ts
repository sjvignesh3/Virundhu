import { Module } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { SimulatedPaymentProvider } from "./providers/simulated.provider";
import { PAYMENT_PROVIDER } from "./payment-provider.interface";

/**
 * Provider-swappable payment layer. Today: SIMULATED. Tomorrow: add
 * `RazorpayPaymentProvider` and switch the factory. OrderService only
 * depends on PaymentsService, never on a concrete provider.
 */
@Module({
  providers: [
    PaymentsService,
    SimulatedPaymentProvider,
    { provide: PAYMENT_PROVIDER, useExisting: SimulatedPaymentProvider },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
