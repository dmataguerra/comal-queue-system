import { createApp } from './bootstrap.js';

async function main() {
  const app = await createApp();
  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe ser un puerto válido.');
  const host = process.env.HOST || '127.0.0.1';
  await app.listen(port, host);
  console.log(`Comal++ local: http://${host}:${port}`);
}

main().catch((error: unknown) => {
  console.error('No se pudo iniciar el servidor local:', error);
  process.exitCode = 1;
});
