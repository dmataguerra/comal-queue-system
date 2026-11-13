import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
if (process.platform !== 'win32') throw new Error('La prueba de actualización requiere Windows.');
const root = fileURLToPath(new URL('../', import.meta.url));
const previousInstaller = resolve(
  process.argv[2] ?? join(root, 'release', 'archive-0.2.0', 'Comal++ Setup 0.2.0.exe'),
);
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const currentInstaller = resolve(
  process.argv[3] ?? join(root, 'release', `Comal++ Setup ${version}.exe`),
);
for (const filePath of [previousInstaller, currentInstaller])
  assert.ok(existsSync(filePath), `Falta el instalador: ${filePath}`);
const hash = (filePath) =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex').toUpperCase();
const resultsDir = join(root, 'test-results');
mkdirSync(resultsDir, { recursive: true });
const testDir = mkdtempSync(join(resultsDir, 'upgrade-'));
const installDir = join(testDir, 'app');
const dataDir = join(testDir, 'datos');
const profileDir = join(testDir, 'perfil');
const backupDir = join(testDir, 'respaldo-0.2.0');
const restoredProfileDir = join(testDir, 'perfil-restaurado');
const executable = join(installDir, 'Comal++.exe');
const report = {
  anterior: previousInstaller,
  hashAnterior: hash(previousInstaller),
  actual: currentInstaller,
  hashActual: hash(currentInstaller),
  prueba: testDir,
  pasos: [],
};
let appProcess;
const pause = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
async function waitFor(check, message, ms = 30000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch {
      /* La aplicación puede seguir arrancando. */
    }
    await pause(250);
  }
  throw new Error(message);
}
async function findFreePort() {
  const server = createServer();
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const port = server.address().port;
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return port;
}
function install(filePath) {
  const result = spawnSync(filePath, ['/S', `/D=${installDir}`], {
    timeout: 180000,
    windowsHide: true,
    stdio: 'ignore',
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Falló la instalación de ${filePath}`);
  assert.ok(existsSync(executable), 'Falta el ejecutable instalado.');
}
function stopProcess() {
  if (!appProcess || appProcess.exitCode !== null) return;
  spawnSync('taskkill', ['/PID', String(appProcess.pid), '/T', '/F'], { stdio: 'ignore' });
  appProcess = undefined;
}
function startProcess(port, dataFolder, profileFolder) {
  const logFd = openSync(join(testDir, 'aplicacion.log'), 'a');
  appProcess = spawn(
    executable,
    [`--remote-debugging-port=${port}`, `--user-data-dir=${profileFolder}`],
    {
      env: { ...process.env, TURNERO_DATOS: dataFolder },
      windowsHide: true,
      stdio: ['ignore', logFd, logFd],
    },
  );
  closeSync(logFd);
}
async function openPrevious(profileFolder) {
  startProcess(await findFreePort(), dataDir, profileFolder);
  await waitFor(
    async () =>
      (await fetch('http://127.0.0.1:3001/api/health', { signal: AbortSignal.timeout(5000) })).ok,
    'El servidor local de 0.2.0 no inició.',
  );
  return {
    estado: async () =>
      await (
        await fetch('http://127.0.0.1:3001/api/state', { signal: AbortSignal.timeout(5000) })
      ).json(),
    crear: async (num) => {
      const response = await fetch('http://127.0.0.1:3001/api/turns', {
        signal: AbortSignal.timeout(5000),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: num,
          counter: 0,
          requestId: `upgrade-${Date.now()}-${num}`,
        }),
      });
      assert.equal(response.status, 201);
      return response.json();
    },
  };
}
async function openCurrent(dataFolder) {
  const port = await findFreePort();
  startProcess(port, dataFolder, profileDir);
  const page = await waitFor(async () => {
    const pages = await (
      await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(5000) })
    ).json();
    return pages.find(
      (p) => p.type === 'page' && /\/(vistas\/operador|views\/operator)\//.test(p.url),
    );
  }, 'No abrió el operador instalado.');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => {
      socket.close();
      rejectPromise(new Error('DevTools no conectó en 10 segundos.'));
    }, 10000);
    socket.addEventListener(
      'open',
      () => {
        clearTimeout(timeout);
        resolvePromise();
      },
      { once: true },
    );
    const onFailure = () => {
      clearTimeout(timeout);
      rejectPromise(new Error('DevTools cerró durante conexión.'));
    };
    socket.addEventListener('error', onFailure, { once: true });
    socket.addEventListener('close', onFailure, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const failPending = () => {
    for (const pendingRequest of pending.values()) {
      clearTimeout(pendingRequest.limite);
      pendingRequest.rechazar(new Error('Se perdió la conexión con el ejecutable instalado.'));
    }
    pending.clear();
  };
  socket.addEventListener('close', failPending);
  socket.addEventListener('error', failPending);
  socket.addEventListener('message', (messageEvent) => {
    const message = JSON.parse(messageEvent.data);
    const pendingRequest = pending.get(message.id);
    if (!pendingRequest) return;
    clearTimeout(pendingRequest.limite);
    pending.delete(message.id);
    if (message.error) pendingRequest.rechazar(new Error(message.error.message));
    else pendingRequest.resolver(message.result);
  });
  const evaluate = async (expression) => {
    if (socket.readyState !== WebSocket.OPEN) throw new Error('DevTools no está conectado.');
    const num = ++id;
    const promise = new Promise((resolvePromise, rejectPromise) => {
      const timeout = setTimeout(() => {
        pending.delete(num);
        rejectPromise(new Error('El ejecutable no respondió a DevTools en 15 segundos.'));
      }, 15000);
      pending.set(num, { resolver: resolvePromise, rechazar: rejectPromise, limite: timeout });
    });
    socket.send(
      JSON.stringify({
        id: num,
        method: 'Runtime.evaluate',
        params: { expression, awaitPromise: true, returnByValue: true },
      }),
    );
    const result = await promise;
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await waitFor(() => evaluate('Boolean(window.turnero)'), 'El operador no cargó su API.');
  return { evaluar: evaluate, cerrar: () => socket.close() };
}
try {
  let previousPortBusy = false;
  try {
    await fetch('http://127.0.0.1:3001/api/health', { signal: AbortSignal.timeout(5000) });
    previousPortBusy = true;
  } catch {
    /* Sin respuesta, el puerto anterior no está ocupado. */
  }
  if (previousPortBusy)
    throw new Error('El puerto 3001 ya está ocupado; cierre la versión 0.2.0 antes de la prueba.');
  mkdirSync(dataDir);
  install(previousInstaller);
  const legacyApp = await openPrevious(profileDir);
  assert.deepEqual((await legacyApp.estado()).turns, []);
  await legacyApp.crear('42');
  assert.equal((await legacyApp.estado()).turns[0].number, '42');
  stopProcess();
  await pause(500);
  cpSync(profileDir, backupDir, { recursive: true });
  report.pasos.push('0.2.0 instalada, turno 42 guardado en SQLite y respaldo del perfil creado');
  install(currentInstaller);
  let app = await openCurrent(dataDir);
  assert.equal((await app.evaluar('window.turnero.obtener()')).instantanea.actual, 42);
  assert.equal(
    (await app.evaluar("window.turnero.despachar({tipo:'LLAMAR',entrada:'43'})")).instantanea
      .actual,
    43,
  );
  app.cerrar();
  stopProcess();
  await pause(500);
  report.pasos.push(`actualización a ${version} conservó 42 y guardó 43`);
  install(previousInstaller);
  cpSync(backupDir, restoredProfileDir, { recursive: true });
  const rolledBack = await openPrevious(restoredProfileDir);
  assert.equal((await rolledBack.estado()).turns[0].number, '42');
  stopProcess();
  report.pasos.push('reversión a 0.2.0 con respaldo SQLite restaurado recuperó 42');
  console.log(`PASS: actualización y reversión aisladas; evidencia en ${testDir}`);
} catch (error) {
  report.error = String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  stopProcess();
  report.fecha = new Date().toISOString();
  writeFileSync(join(testDir, 'resultado.json'), `${JSON.stringify(report, null, 2)}\n`);
}
