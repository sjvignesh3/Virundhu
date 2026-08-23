import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { StoresModule } from "./modules/stores/stores.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { ProductsModule } from "./modules/products/products.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PublicModule } from "./modules/public/public.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { PrintersModule } from "./modules/printers/printers.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    StoresModule,
    CategoriesModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    PublicModule,
    DashboardModule,
    ReportsModule,
    PrintersModule,
    SettingsModule,
  ],
})
export class AppModule {}
