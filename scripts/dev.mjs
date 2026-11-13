import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const tsc = ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.main.json'];
if (spawnSync(process.execPath, tsc, { cwd: root, stdio: 'inherit' }).status !== 0) process.exit(1);
// tsc above has just emitted the shared config, so the dev URL comes from one place.
const { devServerUrl } = await import(
  new URL('../build/shared/app-config.js', import.meta.url).href
);
const electronEnv = { ...process.env, TURNERO_DEV_URL: devServerUrl };
delete electronEnv.ELECTRON_RUN_AS_NODE;
const children = [
  spawn(process.execPath, [...tsc, '--watch', '--preserveWatchOutput'], {
    cwd: root,
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], {
    cwd: root,
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['node_modules/electron/cli.js', '.'], {
    cwd: root,
    stdio: 'inherit',
    env: electronEnv,
  }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
