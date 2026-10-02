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
const raiz = fileURLToPath(new URL('../', import.meta.url));
const anterior = resolve(
  process.argv[2] ?? join(raiz, 'release', 'archive-0.2.0', 'Comal++ Setup 0.2.0.exe'),
);
const version = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')).version;
const actual = resolve(process.argv[3] ?? join(raiz, 'release', `Comal++ Setup ${version}.exe`));
for (const ruta of [anterior, actual]) assert.ok(existsSync(ruta), `Falta el instalador: ${ruta}`);
const hash = (ruta) => createHash('sha256').update(readFileSync(ruta)).digest('hex').toUpperCase();
const resultados = join(raiz, 'test-results');
mkdirSync(resultados, { recursive: true });
const prueba = mkdtempSync(join(resultados, 'upgrade-'));
const instalacion = join(prueba, 'app');
const datos = join(prueba, 'datos');
const perfil = join(prueba, 'perfil');
const respaldo = join(prueba, 'respaldo-0.2.0');
const restaurado = join(prueba, 'perfil-restaurado');
const ejecutable = join(instalacion, 'Comal++.exe');
const reporte = {
  anterior,
  hashAnterior: hash(anterior),
  actual,
  hashActual: hash(actual),
  prueba,
  pasos: [],
};
let proceso;
const pausa = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
async function esperar(comprobar, mensaje, ms = 30000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    try {
      const valor = await comprobar();
      if (valor) return valor;
    } catch {
      /* Arranque en curso. */
    }
    await pausa(250);
  }
  throw new Error(mensaje);
}
async function puertoLibre() {
  const servidor = createServer();
  await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
  const puerto = servidor.address().port;
  await new Promise((resolver) => servidor.close(resolver));
  return puerto;
}
function instalar(ruta) {
  const resultado = spawnSync(ruta, ['/S', `/D=${instalacion}`], {
    timeout: 180000,
    windowsHide: true,
    stdio: 'ignore',
  });
  if (resultado.error) throw resultado.error;
  assert.equal(resultado.status, 0, `Falló la instalación de ${ruta}`);
  assert.ok(existsSync(ejecutable), 'Falta el ejecutable instalado.');
}
function detener() {
  if (!proceso || proceso.exitCode !== null) return;
  spawnSync('taskkill', ['/PID', String(proceso.pid), '/T', '/F'], { stdio: 'ignore' });
  proceso = undefined;
}
function iniciarProceso(puerto, carpetaDatos, carpetaPerfil) {
  const salida = openSync(join(prueba, 'aplicacion.log'), 'a');
  proceso = spawn(
    ejecutable,
    [`--remote-debugging-port=${puerto}`, `--user-data-dir=${carpetaPerfil}`],
    {
      env: { ...process.env, TURNERO_DATOS: carpetaDatos },
      windowsHide: true,
      stdio: ['ignore', salida, salida],
    },
  );
  closeSync(salida);
}
async function abrirAnterior(carpetaPerfil) {
  iniciarProceso(await puertoLibre(), datos, carpetaPerfil);
  await esperar(
    async () =>
      (await fetch('http://127.0.0.1:3001/api/health', { signal: AbortSignal.timeout(5000) })).ok,
    'El servidor local de 0.2.0 no inició.',
  );
  return {
    estado: async () =>
      await (
        await fetch('http://127.0.0.1:3001/api/state', { signal: AbortSignal.timeout(5000) })
      ).json(),
    crear: async (numero) => {
      const respuesta = await fetch('http://127.0.0.1:3001/api/turns', {
        signal: AbortSignal.timeout(5000),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: numero,
          counter: 0,
          requestId: `upgrade-${Date.now()}-${numero}`,
        }),
      });
      assert.equal(respuesta.status, 201);
      return respuesta.json();
    },
  };
}
async function abrir(carpetaDatos) {
  const puerto = await puertoLibre();
  iniciarProceso(puerto, carpetaDatos, perfil);
  const pagina = await esperar(async () => {
    const paginas = await (
      await fetch(`http://127.0.0.1:${puerto}/json/list`, { signal: AbortSignal.timeout(5000) })
    ).json();
    return paginas.find((p) => p.type === 'page' && p.url.includes('/vistas/operador/'));
  }, 'No abrió el operador instalado.');
  const socket = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((resolver, rechazar) => {
    const limite = setTimeout(() => {
      socket.close();
      rechazar(new Error('DevTools no conectó en 10 segundos.'));
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
      rechazar(new Error('DevTools cerró durante conexión.'));
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
    const pendiente = pendientes.get(mensaje.id);
    if (!pendiente) return;
    clearTimeout(pendiente.limite);
    pendientes.delete(mensaje.id);
    if (mensaje.error) pendiente.rechazar(new Error(mensaje.error.message));
    else pendiente.resolver(mensaje.result);
  });
  const evaluar = async (expression) => {
    if (socket.readyState !== WebSocket.OPEN) throw new Error('DevTools no está conectado.');
    const numero = ++id;
    const promesa = new Promise((resolver, rechazar) => {
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
        params: { expression, awaitPromise: true, returnByValue: true },
      }),
    );
    const resultado = await promesa;
    if (resultado.exceptionDetails) throw new Error(resultado.exceptionDetails.text);
    return resultado.result.value;
  };
  await esperar(() => evaluar('Boolean(window.turnero)'), 'El operador no cargó su API.');
  return { evaluar, cerrar: () => socket.close() };
}
try {
  let puertoAnteriorOcupado = false;
  try {
    await fetch('http://127.0.0.1:3001/api/health', { signal: AbortSignal.timeout(5000) });
    puertoAnteriorOcupado = true;
  } catch {
    // El puerto está libre.
  }
  if (puertoAnteriorOcupado)
    throw new Error('El puerto 3001 ya está ocupado; cierre la versión 0.2.0 antes de la prueba.');
  mkdirSync(datos);
  instalar(anterior);
  const antigua = await abrirAnterior(perfil);
  assert.deepEqual((await antigua.estado()).turns, []);
  await antigua.crear('42');
  assert.equal((await antigua.estado()).turns[0].number, '42');
  detener();
  await pausa(500);
  cpSync(perfil, respaldo, { recursive: true });
  reporte.pasos.push('0.2.0 instalada, turno 42 guardado en SQLite y respaldo del perfil creado');

  instalar(actual);
  let app = await abrir(datos);
  assert.equal((await app.evaluar('window.turnero.obtener()')).instantanea.actual, 42);
  assert.equal(
    (await app.evaluar("window.turnero.despachar({tipo:'LLAMAR',entrada:'43'})")).instantanea
      .actual,
    43,
  );
  app.cerrar();
  detener();
  await pausa(500);
  reporte.pasos.push(`actualización a ${version} conservó 42 y guardó 43`);

  instalar(anterior);
  cpSync(respaldo, restaurado, { recursive: true });
  const revertida = await abrirAnterior(restaurado);
  assert.equal((await revertida.estado()).turns[0].number, '42');
  detener();
  reporte.pasos.push('reversión a 0.2.0 con respaldo SQLite restaurado recuperó 42');
  console.log(`PASS: actualización y reversión aisladas; evidencia en ${prueba}`);
} catch (error) {
  reporte.error = String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  detener();
  reporte.fecha = new Date().toISOString();
  writeFileSync(join(prueba, 'resultado.json'), `${JSON.stringify(reporte, null, 2)}\n`);
}
