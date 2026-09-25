import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pruebas = join(raiz, 'test-results');
const temporal = join(pruebas, `package-stage-${randomUUID()}`);
if (!temporal.startsWith(`${resolve(pruebas)}${sep}`))
  throw new Error('La carpeta temporal de empaquetado está fuera de test-results.');
const argumentos = process.argv.slice(2);
const permitidos = new Set(['--win', '--dir', '-c.win.forceCodeSigning=true']);
if (!argumentos.length || argumentos.some((argumento) => !permitidos.has(argumento))) {
  console.error('Uso: node scripts/package-desktop.mjs --win|--dir [-c.win.forceCodeSigning=true]');
  process.exit(2);
}

const paquete = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
const electron = JSON.parse(
  readFileSync(join(raiz, 'node_modules', 'electron', 'package.json'), 'utf8'),
);
delete paquete.devDependencies;
paquete.build = {
  ...paquete.build,
  electronVersion: electron.version,
  electronDist: join(raiz, 'node_modules', 'electron', 'dist'),
  directories: { ...paquete.build.directories, output: join(raiz, 'release') },
};

try {
  mkdirSync(temporal, { recursive: true });
  for (const nombre of ['build', 'dist', 'contenido'])
    cpSync(join(raiz, nombre), join(temporal, nombre), { recursive: true });
  writeFileSync(join(temporal, 'package.json'), `${JSON.stringify(paquete, null, 2)}\n`);
  const resultado = spawnSync(
    process.execPath,
    [join(raiz, 'node_modules', 'electron-builder', 'cli.js'), ...argumentos],
    { cwd: temporal, stdio: 'inherit', env: process.env },
  );
  if (resultado.error) throw resultado.error;
  process.exitCode = resultado.status ?? 1;
} finally {
  rmSync(temporal, { recursive: true, force: true });
}
