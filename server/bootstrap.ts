import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module.js';
import { allowedOrigins } from './origins.js';

export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  app.enableCors({ origin: allowedOrigins(), methods: ['GET', 'POST', 'PUT', 'PATCH'], allowedHeaders: ['Content-Type'] });
  app.enableShutdownHooks();
  const dist = resolve('dist');
  if (existsSync(resolve(dist, 'index.html'))) {
    app.useStaticAssets(dist, { index: false });
    // Explicit SPA routes keep unknown API/media paths returning real 404s.
    const instance = app.getHttpAdapter().getInstance();
    for (const route of ['/', '/caja', '/pantalla', '/admin', '/display']) {
      instance.get(route, (_request: unknown, response: { sendFile: (file: string) => void }) => response.sendFile(resolve(dist, 'index.html')));
    }
  }
  return app;
}
