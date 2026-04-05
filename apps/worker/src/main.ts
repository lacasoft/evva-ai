import 'reflect-metadata';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerAppModule } from './app.module.js';

// Cargar .env desde la raíz del monorepo antes de NestJS
(function loadEnv() {
  const root = resolve(__dirname, '../../../');
  for (const name of ['.env.local', '.env']) {
    const envPath = join(root, name);
    if (!existsSync(envPath)) continue;
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
})();

const logger = new Logger('WorkerBootstrap');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // El worker no expone HTTP — solo procesa queues
  await app.init();

  logger.log('Evva Worker iniciado — procesando queues');

  // Mantener el proceso vivo
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM recibido — cerrando worker');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  console.error('Error arrancando Evva Worker:', err);
  process.exit(1);
});
