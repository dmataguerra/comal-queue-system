import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const tsc = ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.main.json'];
// El proceso principal se compila una vez antes de abrir Electron; después queda en modo watch.
if (spawnSync(process.execPath, tsc, { cwd: root, stdio: 'inherit' }).status !== 0) process.exit(1);
// Algunas terminales (p. ej. procesos lanzados desde extensiones de VS Code) heredan
// ELECTRON_RUN_AS_NODE=1, que haría arrancar Electron como Node sin ventanas.
const electronEnv = { ...process.env, TURNERO_DEV_URL: 'http://127.0.0.1:5173' };
delete electronEnv.ELECTRON_RUN_AS_NODE;
const children = [
  spawn(process.execPath, [...tsc, '--watch', '--preserveWatchOutput'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/electron/cli.js', '.'], { cwd: root, stdio: 'inherit', env: electronEnv })
];
let stopping = false;
function stop(code=0) { if(stopping)return;stopping=true;for(const child of children)child.kill();process.exitCode=code; }
for(const child of children) { child.on('error',error=>{console.error(error.message);stop(1);}); child.on('exit',code=>{if(!stopping)stop(code??1);}); }
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
