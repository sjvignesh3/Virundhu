import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });

  // CORS_ORIGIN accepts a comma-separated list. Each entry may be:
  //   • an exact origin  → "https://virundhu.vercel.app"
  //   • a wildcard host  → "https://*.vercel.app"  (matches preview deploys)
  //   • "*"              → allow any origin (not recommended with credentials)
  const rawOrigins = process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean) ?? [
    "http://localhost:3000",
  ];
  const exactOrigins = new Set(rawOrigins.filter((o) => !o.includes("*")));
  const wildcardPatterns = rawOrigins
    .filter((o) => o.includes("*"))
    .map((o) => new RegExp("^" + o.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"));
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin / curl / server-to-server
      if (exactOrigins.has(origin)) return cb(null, true);
      if (wildcardPatterns.some((re) => re.test(origin))) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger / OpenAPI at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Cart SaaS API")
    .setDescription("Food Cart ordering & operations platform — Phase 2")
    .setVersion("2.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" })
    .addTag("auth")
    .addTag("public")
    .addTag("stores")
    .addTag("categories")
    .addTag("products")
    .addTag("orders")
    .addTag("dashboard")
    .addTag("reports")
    .addTag("settings")
    .addTag("printers")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`🚀 API listening on http://localhost:${port}/api`, "Bootstrap");
  Logger.log(`📖 Swagger UI on http://localhost:${port}/api/docs`, "Bootstrap");
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Bootstrap error:", err);
  process.exit(1);
});
