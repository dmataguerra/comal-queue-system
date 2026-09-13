import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const children = [
  spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'watch', '--tsconfig', 'tsconfig.server.json', 'server/main.ts'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { cwd: root, stdio: 'inherit' })
];
let stopping = false;
function stop(code=0) { if(stopping)return;stopping=true;for(const child of children)child.kill();process.exitCode=code; }
for(const child of children) { child.on('error',error=>{console.error(error.message);stop(1);}); child.on('exit',code=>{if(!stopping)stop(code??1);}); }
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
