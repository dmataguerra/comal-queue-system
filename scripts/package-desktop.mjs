import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { prepararCompatibilidadNsis } from './nsis-compat.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pruebas = join(raiz, 'test-results');
const temporal = join(pruebas, `package-stage-${randomUUID()}`);
const cacheBuilder = join(pruebas, 'electron-builder-cache');
if (!temporal.startsWith(`${resolve(pruebas)}${sep}`))
  throw new Error('La carpeta temporal de empaquetado está fuera de test-results.');
const argumentos = process.argv.slice(2);
const permitidos = new Set(['--win', '--dir', '--firma-local', '-c.win.forceCodeSigning=true']);
if (!argumentos.length || argumentos.some((argumento) => !permitidos.has(argumento))) {
  console.error(
    'Uso: node scripts/package-desktop.mjs --win|--dir [--firma-local|-c.win.forceCodeSigning=true]',
  );
  process.exit(2);
}
const firmaLocal = argumentos.includes('--firma-local');
const argumentosBuilder = argumentos.filter((argumento) => argumento !== '--firma-local');
let huellaFirmaLocal;
if (firmaLocal) {
  if (process.platform !== 'win32') throw new Error('La firma local requiere Windows.');
  if (
    ['WIN_CSC_LINK', 'CSC_LINK', 'WIN_CSC_KEY_PASSWORD', 'CSC_KEY_PASSWORD'].some(
      (clave) => process.env[clave],
    )
  )
    throw new Error(
      'La firma local usa el almacén de Windows; quite las variables CSC de archivo PFX.',
    );
  huellaFirmaLocal = process.env.COMAL_SIGNING_CERT_SHA1?.replace(/\s/g, '').toUpperCase();
  if (!huellaFirmaLocal || !/^[0-9A-F]{40}$/.test(huellaFirmaLocal))
    throw new Error('Indique la huella SHA-1 del certificado en COMAL_SIGNING_CERT_SHA1.');
  const comprobacion = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-File',
      join(raiz, 'scripts', 'validar-certificado-local.ps1'),
      '-Huella',
      huellaFirmaLocal,
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  if (comprobacion.error || comprobacion.status !== 0)
    throw new Error(
      'No se encontró una clave privada RSA de Comal protegida por el TPM en el almacén del usuario actual.',
    );
}

const paquete = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
const electron = JSON.parse(
  readFileSync(join(raiz, 'node_modules', 'electron', 'package.json'), 'utf8'),
);
const electronDist = join(raiz, 'node_modules', 'electron', 'dist');
// Electron 44 downloads its binary on first launch. Packaging needs the directory first.
if (!existsSync(electronDist)) {
  const install = spawnSync(
    process.execPath,
    [join(raiz, 'node_modules', 'electron', 'install.js')],
    {
      cwd: raiz,
      stdio: 'inherit',
      env: process.env,
    },
  );
  if (install.error) throw install.error;
  if (install.status !== 0 || !existsSync(electronDist))
    throw new Error('Electron binary installation did not complete.');
}
delete paquete.devDependencies;
paquete.build = {
  ...paquete.build,
  electronVersion: electron.version,
  electronDist,
  directories: { ...paquete.build.directories, output: join(raiz, 'release') },
};
if (firmaLocal) {
  paquete.build.win = {
    ...paquete.build.win,
    forceCodeSigning: true,
    signtoolOptions: {
      certificateSha1: huellaFirmaLocal,
      signingHashAlgorithms: ['sha256'],
    },
  };
}

try {
  mkdirSync(temporal, { recursive: true });
  mkdirSync(cacheBuilder, { recursive: true });
  paquete.build.nsis = {
    ...paquete.build.nsis,
    include: prepararCompatibilidadNsis(raiz, temporal),
  };
  for (const nombre of ['build', 'dist', 'contenido', 'LICENSE'])
    cpSync(join(raiz, nombre), join(temporal, nombre), { recursive: true });
  writeFileSync(join(temporal, 'package.json'), `${JSON.stringify(paquete, null, 2)}\n`);
  const resultado = spawnSync(
    process.execPath,
    [join(raiz, 'node_modules', 'electron-builder', 'cli.js'), ...argumentosBuilder],
    {
      cwd: temporal,
      stdio: 'inherit',
      env: {
        ...process.env,
        ELECTRON_BUILDER_CACHE: process.env.ELECTRON_BUILDER_CACHE ?? cacheBuilder,
      },
    },
  );
  if (resultado.error) throw resultado.error;
  process.exitCode = resultado.status ?? 1;
} finally {
  rmSync(temporal, { recursive: true, force: true });
}
