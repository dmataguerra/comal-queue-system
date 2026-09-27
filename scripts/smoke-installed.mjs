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
    const respuesta = await fetch(`http://127.0.0.1:${puerto}/json/list`);
    const paginas = await respuesta.json();
    return paginas.find((p) => p.type === 'page' && p.url.includes('/vistas/operador/'));
  }, 'No apareció la vista del operador en el ejecutable instalado.');
  const socket = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((resolver, rechazar) => {
    socket.addEventListener('open', resolver, { once: true });
    socket.addEventListener('error', rechazar, { once: true });
  });
  let id = 0;
  const pendientes = new Map();
  socket.addEventListener('message', (evento) => {
    const mensaje = JSON.parse(evento.data);
    if (!mensaje.id || !pendientes.has(mensaje.id)) return;
    const { resolver, rechazar } = pendientes.get(mensaje.id);
    pendientes.delete(mensaje.id);
    if (mensaje.error) rechazar(new Error(mensaje.error.message));
    else resolver(mensaje.result);
  });
  return {
    async evaluar(expresion) {
      const numero = ++id;
      const respuesta = new Promise((resolver, rechazar) =>
        pendientes.set(numero, { resolver, rechazar }),
      );
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

  async function abrir() {
    const puerto = await puertoLibre();
    const salida = openSync(join(prueba, 'aplicacion.log'), 'a');
    proceso = spawn(
      ejecutable,
      [`--remote-debugging-port=${puerto}`, `--user-data-dir=${join(prueba, 'electron-profile')}`],
      {
        env: { ...process.env, TURNERO_DATOS: datos },
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
