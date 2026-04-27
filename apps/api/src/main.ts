import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = Number(process.env.PORT ?? 4000);
  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";
  const uploadsRoot = resolve(process.cwd(), "uploads");

  mkdirSync(uploadsRoot, { recursive: true });

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useStaticAssets(uploadsRoot, {
    prefix: "/uploads/",
  });

  await app.listen(port);
}

bootstrap();
