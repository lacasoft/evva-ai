import "reflect-metadata";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module.js";

// Cargar .env desde la raíz del monorepo antes de NestJS
(function loadEnv() {
  const root = resolve(__dirname, "../../../");
  for (const name of [".env.local", ".env"]) {
    const envPath = join(root, name);
    if (!existsSync(envPath)) continue;
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
})();

const logger = new Logger("Bootstrap");

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["log", "error", "warn", "debug"],
  });

  // Prefix global para rutas de la API
  app.setGlobalPrefix("api");

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Evva Gateway corriendo en puerto ${port}`);
  logger.log(`Ambiente: ${process.env.NODE_ENV ?? "development"}`);
}

bootstrap().catch((err) => {
  console.error("Error arrancando Evva Gateway:", err);
  process.exit(1);
});
