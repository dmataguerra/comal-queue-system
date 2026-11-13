import assert from 'node:assert/strict';
import { extractFile } from '@electron/asar';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
if (process.platform !== 'win32') throw new Error('Esta prueba requiere Windows.');
const root = fileURLToPath(new URL('../', import.meta.url));
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const installer = resolve(process.argv[2] ?? join(root, 'release', `Comal++ Setup ${version}.exe`));
const previousInstaller = process.argv[3] ? resolve(process.argv[3]) : null;
assert.ok(existsSync(installer), `Falta el instalador: ${installer}`);
const hash = createHash('sha256').update(readFileSync(installer)).digest('hex').toUpperCase();
const resultsDir = join(root, 'test-results');
mkdirSync(resultsDir, { recursive: true });
const testDir = mkdtempSync(join(resultsDir, 'installed-'));
const installDir = join(testDir, 'app');
const dataDir = join(testDir, 'datos');
mkdirSync(dataDir);
const executable = join(installDir, 'Comal++.exe');
const pause = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
const report = {
  inicio: new Date().toISOString(),
  instalador: installer,
  archivo: basename(installer),
  version,
  sha256: hash,
  prueba: testDir,
  pasos: [],
};
async function findFreePort() {
  const server = createServer();
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const port = server.address().port;
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return port;
}
async function waitFor(check, message, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch {
      /* El ejecutable puede seguir arrancando. */
    }
    await pause(250);
  }
  throw new Error(message);
}
async function connect(port) {
  const page = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(5000),
    });
    const pages = await response.json();
    return pages.find((p) => p.type === 'page' && p.url.includes('/views/operator/'));
  }, 'No apareció la vista del operador en el ejecutable instalado.');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => {
      socket.close();
      rejectPromise(new Error('Timeout al conectar DevTools.'));
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
      rejectPromise(new Error('DevTools cerró durante la conexión.'));
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
    if (!message.id || !pending.has(message.id)) return;
    const {
      resolver: resolvePromise,
      rechazar: rejectPromise,
      limite: timeout,
    } = pending.get(message.id);
    clearTimeout(timeout);
    pending.delete(message.id);
    if (message.error) rejectPromise(new Error(message.error.message));
    else resolvePromise(message.result);
  });
  return {
    async evaluar(expression) {
      if (socket.readyState !== WebSocket.OPEN) throw new Error('DevTools no está conectado.');
      const requestId = ++id;
      const response = new Promise((resolvePromise, rejectPromise) => {
        const timeout = setTimeout(() => {
          pending.delete(requestId);
          rejectPromise(new Error('El ejecutable no respondió a DevTools en 15 segundos.'));
        }, 15000);
        pending.set(requestId, {
          resolver: resolvePromise,
          rechazar: rejectPromise,
          limite: timeout,
        });
      });
      socket.send(
        JSON.stringify({
          id: requestId,
          method: 'Runtime.evaluate',
          params: { expression: expression, awaitPromise: true, returnByValue: true },
        }),
      );
      const result = await response;
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    },
    cerrar() {
      socket.close();
    },
  };
}
function stopProcess(appProcess) {
  if (!appProcess || appProcess.exitCode !== null) return;
  spawnSync('taskkill', ['/PID', String(appProcess.pid), '/T', '/F'], { stdio: 'ignore' });
}
let appProcess;
try {
  if (previousInstaller) {
    assert.ok(existsSync(previousInstaller), 'No existe el instalador anterior.');
    const previousInstall = spawnSync(
      previousInstaller,
      ['/S', '--no-desktop-shortcut', `/D=${join(testDir, 'legacy-app')}`],
      {
        timeout: 180000,
        windowsHide: true,
        stdio: 'ignore',
      },
    );
    if (previousInstall.error) throw previousInstall.error;
    assert.equal(previousInstall.status, 0, 'Falló la preparación de la instalación anterior.');
    report.instaladorAnterior = previousInstaller;
    report.sha256Anterior = createHash('sha256')
      .update(readFileSync(previousInstaller))
      .digest('hex')
      .toUpperCase();
    report.pasos.push(
      'instalador histórico preparado en otra carpeta sin crear acceso de Escritorio',
    );
  }
  const installResult = spawnSync(installer, ['/S', `/D=${installDir}`], {
    timeout: 180000,
    windowsHide: true,
    stdio: 'ignore',
  });
  if (installResult.error) throw installResult.error;
  assert.equal(installResult.status, 0, 'El instalador silencioso falló.');
  assert.ok(existsSync(executable), 'El instalador no creó Comal++.exe.');
  assert.ok(existsSync(join(installDir, 'contenido', 'voz', '40.wav')));
  report.pasos.push('instalación aislada y contenido de fábrica');
  const packagedManual = extractFile(
    join(installDir, 'resources', 'app.asar'),
    join('dist', 'manual', 'manual-usuario-0.4.0.pdf'),
  );
  const sourceManual = readFileSync(join(root, 'output/pdf/Comal++_Manual_de_usuario_0.4.0.pdf'));
  assert.deepEqual(packagedManual, sourceManual, 'El instalador debe incluir el manual vigente.');
  report.manualSha256 = createHash('sha256').update(packagedManual).digest('hex');
  report.pasos.push('manual PDF empaquetado idéntico al documento fuente');
  async function launch(useDefaultPath = false) {
    const port = await findFreePort();
    const logFd = openSync(join(testDir, 'aplicacion.log'), 'a');
    const env = { ...process.env, TURNERO_DATOS: dataDir };
    if (useDefaultPath) delete env.TURNERO_DATOS;
    appProcess = spawn(
      executable,
      [`--remote-debugging-port=${port}`, `--user-data-dir=${join(testDir, 'electron-profile')}`],
      {
        env: env,
        windowsHide: true,
        stdio: ['ignore', logFd, logFd],
      },
    );
    closeSync(logFd);
    appProcess.on('error', (error) => {
      report.errorProceso = String(error);
    });
    const client = await connect(port);
    await waitFor(
      () => client.evaluar("Boolean(document.querySelector('#turn-number'))"),
      'No cargó el operador instalado.',
    );
    return client;
  }
  let client = await launch();
  const initialState = await client.evaluar('window.turnero.obtener()');
  assert.equal(initialState.instantanea.actual, null);
  await client.evaluar(`(() => {
    const input = document.querySelector('#turn-number');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '42');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await waitFor(
    () => client.evaluar("document.querySelector('#turn-number').value === '42'"),
    'No se pudo preparar una captura válida para comprobar el bloqueo del recorrido.',
  );
  await client.evaluar("document.querySelector('.help-button').click()");
  await waitFor(
    () => client.evaluar('Boolean(document.querySelector(\'[data-testid="help-center"]\'))'),
    'El centro de ayuda no abrió en la aplicación instalada.',
  );
  await client.evaluar(
    'document.querySelector(\'[data-testid="help-tour-start-llamar"]\').click()',
  );
  await waitFor(
    () => client.evaluar('Boolean(document.querySelector(\'[data-testid="help-tour"]\'))'),
    'El recorrido no abrió en la aplicación instalada.',
  );
  await client.evaluar("document.querySelector('.register-button').click()");
  assert.deepEqual(
    (await client.evaluar('window.turnero.obtener()')).instantanea,
    initialState.instantanea,
    'El recorrido instalado no debe modificar la cola.',
  );
  await client.evaluar('document.querySelector(\'[data-testid="help-tour-close"]\').click()');
  await waitFor(
    () => client.evaluar('Boolean(document.querySelector(\'[data-testid="help-center"]\'))'),
    'Cerrar el recorrido no devolvió al centro de ayuda.',
  );
  await client.evaluar("document.querySelector('.help-center .modal-heading button').click()");
  report.pasos.push('ayuda y recorrido instalados abren, bloquean operaciones y cierran');
  const callResult = await client.evaluar("window.turnero.despachar({tipo:'LLAMAR',entrada:'42'})");
  assert.equal(callResult.instantanea.actual, 42);
  assert.ok(existsSync(join(dataDir, 'estado.json')));
  report.pasos.push('arranque y llamada 42 desde el ejecutable instalado');
  client.cerrar();
  stopProcess(appProcess);
  await pause(500);
  client = await launch();
  const restored = await client.evaluar('window.turnero.obtener()');
  assert.equal(restored.instantanea.actual, 42);
  client.cerrar();
  report.pasos.push('conservación de estado tras reinicio del ejecutable');
  stopProcess(appProcess);
  await pause(500);
  const profileDataDir = join(testDir, 'electron-profile', 'datos');
  mkdirSync(profileDataDir, { recursive: true });
  client = await launch(true);
  const profileState = await client.evaluar('window.turnero.obtener()');
  assert.equal(profileState.instantanea.actual, null);
  const profileCallResult = await client.evaluar(
    "window.turnero.despachar({tipo:'LLAMAR',entrada:'43'})",
  );
  assert.equal(profileCallResult.instantanea.actual, 43);
  assert.equal(JSON.parse(readFileSync(join(profileDataDir, 'estado.json'), 'utf8')).actual, 43);
  assert.ok(existsSync(join(profileDataDir, 'config.json')));
  assert.ok(existsSync(join(profileDataDir, 'contenido', 'voz', '40.wav')));
  client.cerrar();
  stopProcess(appProcess);
  await pause(500);
  client = await launch(true);
  const persistedProfile = await client.evaluar('window.turnero.obtener()');
  assert.equal(persistedProfile.instantanea.actual, 43);
  client.cerrar();
  report.pasos.push(
    'ruta predeterminada sin TURNERO_DATOS: llamada 43, contenido y persistencia en perfil/datos',
  );
  const defenderCheck = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `
    $ErrorActionPreference = 'Stop'
    $eventos = @(Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Windows Defender/Operational'; Id=1123; StartTime=[datetime]::Parse($env:COMAL_TEST_START)} -ErrorAction SilentlyContinue -ErrorVariable consultaError)
    foreach ($fallo in $consultaError) {
      if ($fallo.FullyQualifiedErrorId -notlike 'NoMatchingEventsFound*') { throw $fallo }
    }
    $bloqueos = @($eventos | Where-Object {
      $_.Message.IndexOf($env:COMAL_TEST_INSTALLER, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
      $_.Message.IndexOf($env:COMAL_TEST_DIRECTORY, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
      $_.Message.IndexOf('old-uninstaller.exe', [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
      $_.Message.IndexOf('Uninstall Comal', [StringComparison]::OrdinalIgnoreCase) -ge 0
    } | Select-Object TimeCreated, Message)
    ConvertTo-Json -InputObject $bloqueos -Compress
  `,
    ],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      env: {
        ...process.env,
        COMAL_TEST_START: report.inicio,
        COMAL_TEST_INSTALLER: installer,
        COMAL_TEST_DIRECTORY: installDir,
      },
    },
  );
  assert.equal(
    defenderCheck.status,
    0,
    `No se pudo verificar el registro de Defender: ${defenderCheck.stderr || defenderCheck.error}`,
  );
  report.bloqueosDefender = JSON.parse(defenderCheck.stdout.replace(/^\uFEFF/, '').trim());
  assert.equal(
    report.bloqueosDefender.length,
    0,
    'Defender bloqueó al instalador o a la aplicación durante la prueba.',
  );
  report.pasos.push(
    'sin eventos 1123 de acceso a carpetas protegidas para el instalador y aplicación probados',
  );
  console.log(`PASS: instalador ${hash}; evidencia en ${testDir}`);
} catch (error) {
  report.error = String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  stopProcess(appProcess);
  report.fecha = new Date().toISOString();
  writeFileSync(join(testDir, 'resultado.json'), `${JSON.stringify(report, null, 2)}\n`);
}
