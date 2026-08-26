import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  PAYMENT_PROVIDER,
  type IPaymentProvider,
} from "./payment-provider.interface";
import { toPrismaDecimal } from "../../common/mappers/decimal";
import type { PaymentMethod } from "@virundhu/shared";
import { toPaymentDTO } from "../../common/mappers/entities";
import { PrismaService } from "../../prisma/prisma.service";

export type TxClient = Prisma.TransactionClient | PrismaClient;

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: IPaymentProvider,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Charges via the configured provider and persists the payment row.
   * Accepts an optional transaction client so OrderService can atomically
   * create the payment alongside the order.
   */
  async chargeAndRecord(
    orderId: string,
    amount: number,
    method: PaymentMethod | undefined,
    tx: TxClient = this.prisma,
  ) {
    const result = await this.provider.charge({ orderId, amount, method });
    const payment = await tx.payment.create({
      data: {
        orderId,
        provider: result.provider,
        providerPaymentId: result.providerPaymentId,
        method: result.method,
        status: result.status,
        amount: toPrismaDecimal(amount),
      },
    });
    return { payment: toPaymentDTO(payment), result };
  }
}
