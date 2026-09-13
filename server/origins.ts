export function allowedOrigins(): string[] {
  const port = process.env.PORT || '3001';
  return [...new Set([
    ...['localhost', '127.0.0.1'].flatMap((host) => ['5173', '4173', port].map((value) => `http://${host}:${value}`)),
    ...(process.env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean),
  ])];
}
