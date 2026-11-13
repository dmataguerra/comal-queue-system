import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { prepareNsisCompatibility } from './nsis-compat.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testResults = join(root, 'test-results');
const stageDir = join(testResults, `package-stage-${randomUUID()}`);
const builderCache = join(testResults, 'electron-builder-cache');
if (!stageDir.startsWith(`${resolve(testResults)}${sep}`))
  throw new Error('La carpeta temporal de empaquetado está fuera de test-results.');
const args = process.argv.slice(2);
const allowedArgs = new Set([
  '--win',
  '--dir',
  '--firma-local',
  '--publish',
  'never',
  'always',
  '--publish=never',
  '--publish=always',
  '-c.win.forceCodeSigning=true',
]);
const isValidArg = (arg, index) =>
  arg === 'never' || arg === 'always' ? args[index - 1] === '--publish' : allowedArgs.has(arg);
if (!args.length || args.some((arg, index) => !isValidArg(arg, index))) {
  console.error(
    'Uso: node scripts/package-desktop.mjs --win|--dir [--publish never|always] [--firma-local|-c.win.forceCodeSigning=true]',
  );
  process.exit(2);
}
const localSigning = args.includes('--firma-local');
const builderArgs = args.filter((arg) => arg !== '--firma-local');
let localSigningThumbprint;
if (localSigning) {
  if (process.platform !== 'win32') throw new Error('La firma local requiere Windows.');
  if (
    ['WIN_CSC_LINK', 'CSC_LINK', 'WIN_CSC_KEY_PASSWORD', 'CSC_KEY_PASSWORD'].some(
      (key) => process.env[key],
    )
  )
    throw new Error(
      'La firma local usa el almacén de Windows; quite las variables CSC de archivo PFX.',
    );
  localSigningThumbprint = process.env.COMAL_SIGNING_CERT_SHA1?.replace(/\s/g, '').toUpperCase();
  if (!localSigningThumbprint || !/^[0-9A-F]{40}$/.test(localSigningThumbprint))
    throw new Error('Indique la huella SHA-1 del certificado en COMAL_SIGNING_CERT_SHA1.');
  const check = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-File',
      join(root, 'scripts', 'verify-local-certificate.ps1'),
      '-Huella',
      localSigningThumbprint,
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  if (check.error || check.status !== 0)
    throw new Error(
      'No se encontró una clave privada RSA de Comal protegida por el TPM en el almacén del usuario actual.',
    );
}
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const electron = JSON.parse(
  readFileSync(join(root, 'node_modules', 'electron', 'package.json'), 'utf8'),
);
const electronDist = join(root, 'node_modules', 'electron', 'dist');
if (!existsSync(electronDist)) {
  const install = spawnSync(
    process.execPath,
    [join(root, 'node_modules', 'electron', 'install.js')],
    {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    },
  );
  if (install.error) throw install.error;
  if (install.status !== 0 || !existsSync(electronDist))
    throw new Error('Electron binary installation did not complete.');
}
delete packageJson.devDependencies;
packageJson.build = {
  ...packageJson.build,
  electronVersion: electron.version,
  electronDist,
  directories: { ...packageJson.build.directories, output: join(root, 'release') },
};
if (localSigning) {
  packageJson.build.win = {
    ...packageJson.build.win,
    forceCodeSigning: true,
    signtoolOptions: {
      certificateSha1: localSigningThumbprint,
      signingHashAlgorithms: ['sha256'],
    },
  };
}
try {
  mkdirSync(stageDir, { recursive: true });
  mkdirSync(builderCache, { recursive: true });
  packageJson.build.nsis = {
    ...packageJson.build.nsis,
    include: prepareNsisCompatibility(root, stageDir),
  };
  for (const name of ['build', 'dist', 'contenido', 'LICENSE'])
    cpSync(join(root, name), join(stageDir, name), { recursive: true });
  cpSync(
    join(root, 'public', 'assets', 'branding'),
    join(stageDir, 'public', 'assets', 'branding'),
    { recursive: true },
  );
  writeFileSync(join(stageDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  const result = spawnSync(
    process.execPath,
    [join(root, 'node_modules', 'electron-builder', 'cli.js'), ...builderArgs],
    {
      cwd: stageDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        ELECTRON_BUILDER_CACHE: process.env.ELECTRON_BUILDER_CACHE ?? builderCache,
      },
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(stageDir, { recursive: true, force: true });
}
