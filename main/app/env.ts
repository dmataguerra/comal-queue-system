export interface AppEnv {
  /** Vite dev server origin; set only by `npm run dev`. */
  devUrl: string | undefined;
  /** Overrides the data folder (tests and portable setups). */
  dataDir: string | undefined;
  /** Port for the local browser server. `0` asks the OS for a free port. */
  serverPort: number | undefined;
}
/** Parses the environment once so the rest of the app never reads `process.env`. */
export function readEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const rawPort = env.TURNERO_PUERTO;
  const port = rawPort !== undefined && /^\d{1,5}$/.test(rawPort) ? Number(rawPort) : undefined;
  return {
    devUrl: env.TURNERO_DEV_URL || undefined,
    dataDir: env.TURNERO_DATOS || undefined,
    serverPort: port !== undefined && port <= 65535 ? port : undefined,
  };
}
