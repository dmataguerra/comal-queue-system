import assert from 'node:assert/strict';
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
const raiz = fileURLToPath(new URL('../', import.meta.url));
const version = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')).version;
const instalador = resolve(
  process.argv[2] ?? join(raiz, 'release', `Comal++ Setup ${version}.exe`),
);
const instaladorAnterior = process.argv[3] ? resolve(process.argv[3]) : null;
assert.ok(existsSync(instalador), `Falta el instalador: ${instalador}`);
const hash = createHash('sha256').update(readFileSync(instalador)).digest('hex').toUpperCase();
const resultados = join(raiz, 'test-results');
mkdirSync(resultados, { recursive: true });
const prueba = mkdtempSync(join(resultados, 'installed-'));
const instalacion = join(prueba, 'app');
const datos = join(prueba, 'datos');
mkdirSync(datos);
const ejecutable = join(instalacion, 'Comal++.exe');
const pausa = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const reporte = {
  inicio: new Date().toISOString(),
  instalador,
  archivo: basename(instalador),
  version,
  sha256: hash,
  prueba,
  pasos: [],
};

async function puertoLibre() {
  const servidor = createServer();
  await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
  const puerto = servidor.address().port;
  await new Promise((resolver) => servidor.close(resolver));
  return puerto;
}

async function esperar(comprobar, mensaje, limite = 30000) {
  const fin = Date.now() + limite;
  while (Date.now() < fin) {
    try {
      const resultado = await comprobar();
      if (resultado) return resultado;
    } catch {
      // El ejecutable puede seguir arrancando.
    }
    await pausa(250);
  }
  throw new Error(mensaje);
}

async function conectar(puerto) {
  const pagina = await esperar(async () => {
    const respuesta = await fetch(`http://127.0.0.1:${puerto}/json/list`, {
      signal: AbortSignal.timeout(5000),
    });
    const paginas = await respuesta.json();
    return paginas.find((p) => p.type === 'page' && p.url.includes('/vistas/operador/'));
  }, 'No apareció la vista del operador en el ejecutable instalado.');
  const socket = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((resolver, rechazar) => {
    const limite = setTimeout(() => {
      socket.close();
      rechazar(new Error('Timeout al conectar DevTools.'));
    }, 10000);
    socket.addEventListener(
      'open',
      () => {
        clearTimeout(limite);
        resolver();
      },
      { once: true },
    );
    const fallo = () => {
      clearTimeout(limite);
      rechazar(new Error('DevTools cerró durante la conexión.'));
    };
    socket.addEventListener('error', fallo, { once: true });
    socket.addEventListener('close', fallo, { once: true });
  });
  let id = 0;
  const pendientes = new Map();
  const fallarPendientes = () => {
    for (const pendiente of pendientes.values()) {
      clearTimeout(pendiente.limite);
      pendiente.rechazar(new Error('Se perdió la conexión con el ejecutable instalado.'));
    }
    pendientes.clear();
  };
  socket.addEventListener('close', fallarPendientes);
  socket.addEventListener('error', fallarPendientes);
  socket.addEventListener('message', (evento) => {
    const mensaje = JSON.parse(evento.data);
    if (!mensaje.id || !pendientes.has(mensaje.id)) return;
    const { resolver, rechazar, limite } = pendientes.get(mensaje.id);
    clearTimeout(limite);
    pendientes.delete(mensaje.id);
    if (mensaje.error) rechazar(new Error(mensaje.error.message));
    else resolver(mensaje.result);
  });
  return {
    async evaluar(expresion) {
      if (socket.readyState !== WebSocket.OPEN) throw new Error('DevTools no está conectado.');
      const numero = ++id;
      const respuesta = new Promise((resolver, rechazar) => {
        const limite = setTimeout(() => {
          pendientes.delete(numero);
          rechazar(new Error('El ejecutable no respondió a DevTools en 15 segundos.'));
        }, 15000);
        pendientes.set(numero, { resolver, rechazar, limite });
      });
      socket.send(
        JSON.stringify({
          id: numero,
          method: 'Runtime.evaluate',
          params: { expression: expresion, awaitPromise: true, returnByValue: true },
        }),
      );
      const resultado = await respuesta;
      if (resultado.exceptionDetails) throw new Error(resultado.exceptionDetails.text);
      return resultado.result.value;
    },
    cerrar() {
      socket.close();
    },
  };
}

function detener(proceso) {
  if (!proceso || proceso.exitCode !== null) return;
  // Solo el árbol del PID que inició esta prueba.
  spawnSync('taskkill', ['/PID', String(proceso.pid), '/T', '/F'], { stdio: 'ignore' });
}

let proceso;
try {
  if (instaladorAnterior) {
    assert.ok(existsSync(instaladorAnterior), 'No existe el instalador anterior.');
    const anterior = spawnSync(
      instaladorAnterior,
      ['/S', '--no-desktop-shortcut', `/D=${join(prueba, 'legacy-app')}`],
      {
        timeout: 180000,
        windowsHide: true,
        stdio: 'ignore',
      },
    );
    if (anterior.error) throw anterior.error;
    assert.equal(anterior.status, 0, 'Falló la preparación de la instalación anterior.');
    reporte.instaladorAnterior = instaladorAnterior;
    reporte.sha256Anterior = createHash('sha256')
      .update(readFileSync(instaladorAnterior))
      .digest('hex')
      .toUpperCase();
    reporte.pasos.push(
      'instalador histórico preparado en otra carpeta sin crear acceso de Escritorio',
    );
  }
  const instalacionResultado = spawnSync(instalador, ['/S', `/D=${instalacion}`], {
    timeout: 180000,
    windowsHide: true,
    stdio: 'ignore',
  });
  if (instalacionResultado.error) throw instalacionResultado.error;
  assert.equal(instalacionResultado.status, 0, 'El instalador silencioso falló.');
  assert.ok(existsSync(ejecutable), 'El instalador no creó Comal++.exe.');
  assert.ok(existsSync(join(instalacion, 'contenido', 'voz', '40.wav')));
  reporte.pasos.push('instalación aislada y contenido de fábrica');

  async function abrir(usarRutaPredeterminada = false) {
    const puerto = await puertoLibre();
    const salida = openSync(join(prueba, 'aplicacion.log'), 'a');
    const entorno = { ...process.env, TURNERO_DATOS: datos };
    if (usarRutaPredeterminada) delete entorno.TURNERO_DATOS;
    proceso = spawn(
      ejecutable,
      [`--remote-debugging-port=${puerto}`, `--user-data-dir=${join(prueba, 'electron-profile')}`],
      {
        env: entorno,
        windowsHide: true,
        stdio: ['ignore', salida, salida],
      },
    );
    closeSync(salida);
    proceso.on('error', (error) => {
      reporte.errorProceso = String(error);
    });
    const cliente = await conectar(puerto);
    await esperar(
      () => cliente.evaluar("Boolean(document.querySelector('#turn-number'))"),
      'No cargó el operador instalado.',
    );
    return cliente;
  }

  let cliente = await abrir();
  const inicial = await cliente.evaluar('window.turnero.obtener()');
  assert.equal(inicial.instantanea.actual, null);
  const llamada = await cliente.evaluar("window.turnero.despachar({tipo:'LLAMAR',entrada:'42'})");
  assert.equal(llamada.instantanea.actual, 42);
  assert.ok(existsSync(join(datos, 'estado.json')));
  reporte.pasos.push('arranque y llamada 42 desde el ejecutable instalado');
  cliente.cerrar();
  detener(proceso);
  await pausa(500);

  cliente = await abrir();
  const restaurado = await cliente.evaluar('window.turnero.obtener()');
  assert.equal(restaurado.instantanea.actual, 42);
  cliente.cerrar();
  reporte.pasos.push('conservación de estado tras reinicio del ejecutable');
  detener(proceso);
  await pausa(500);

  // Aislar también la ruta predeterminada. Crear el destino evita importar datos
  // reales de Documentos; la migración tiene sus propias pruebas con copias ficticias.
  const datosPerfil = join(prueba, 'electron-profile', 'datos');
  mkdirSync(datosPerfil, { recursive: true });
  cliente = await abrir(true);
  const estadoPerfil = await cliente.evaluar('window.turnero.obtener()');
  assert.equal(estadoPerfil.instantanea.actual, null);
  const llamadaPerfil = await cliente.evaluar(
    "window.turnero.despachar({tipo:'LLAMAR',entrada:'43'})",
  );
  assert.equal(llamadaPerfil.instantanea.actual, 43);
  assert.equal(JSON.parse(readFileSync(join(datosPerfil, 'estado.json'), 'utf8')).actual, 43);
  assert.ok(existsSync(join(datosPerfil, 'config.json')));
  assert.ok(existsSync(join(datosPerfil, 'contenido', 'voz', '40.wav')));
  cliente.cerrar();
  detener(proceso);
  await pausa(500);
  cliente = await abrir(true);
  const persistidoPerfil = await cliente.evaluar('window.turnero.obtener()');
  assert.equal(persistidoPerfil.instantanea.actual, 43);
  cliente.cerrar();
  reporte.pasos.push(
    'ruta predeterminada sin TURNERO_DATOS: llamada 43, contenido y persistencia en perfil/datos',
  );
  const defender = spawnSync(
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
        COMAL_TEST_START: reporte.inicio,
        COMAL_TEST_INSTALLER: instalador,
        COMAL_TEST_DIRECTORY: instalacion,
      },
    },
  );
  assert.equal(
    defender.status,
    0,
    `No se pudo verificar el registro de Defender: ${defender.stderr || defender.error}`,
  );
  reporte.bloqueosDefender = JSON.parse(defender.stdout.replace(/^\uFEFF/, '').trim());
  assert.equal(
    reporte.bloqueosDefender.length,
    0,
    'Defender bloqueó al instalador o a la aplicación durante la prueba.',
  );
  reporte.pasos.push(
    'sin eventos 1123 de acceso a carpetas protegidas para el instalador y aplicación probados',
  );
  console.log(`PASS: instalador ${hash}; evidencia en ${prueba}`);
} catch (error) {
  reporte.error = String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  detener(proceso);
  reporte.fecha = new Date().toISOString();
  writeFileSync(join(prueba, 'resultado.json'), `${JSON.stringify(reporte, null, 2)}\n`);
}
