import { app, dialog, Menu, net, protocol, shell, session } from 'electron';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { conectarIpc } from './adaptador-ipc.js';
import { leerConfig, msHastaHora, vigilarConfig } from './config.js';
import { importarArchivos, quitarArchivo, TIPOS_MIME, sembrarContenido, vigilarContenido } from './contenido.js';
import type { CategoriaContenido, Config, Inventario, Pantallas, ResultadoImportacion } from './contrato.js';
import { crearRegistro } from './log.js';
import { crearStore } from './store.js';
import { crearVentanas, type Vista } from './ventanas.js';

// Debe registrarse antes de `ready`. `stream` permite servir video por rangos.
protocol.registerSchemesAsPrivileged([
  { scheme: 'turnero', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

const desarrollo = !app.isPackaged;
const urlDesarrollo = process.env.TURNERO_DEV_URL;
const raizApp = app.getAppPath();
// config.json, contenido/ y estado.json van en Documentos para que el administrador los edite (§5).
// Junto al .exe no: el desinstalador de NSIS borra esa carpeta en cada actualización, y en
// Program Files no se puede escribir. En desarrollo, la raíz del proyecto.
const carpetaDatos = process.env.TURNERO_DATOS ? resolve(process.env.TURNERO_DATOS)
  : app.isPackaged ? join(app.getPath('documents'), 'Turnero Comal') : raizApp;
const carpetaContenido = join(carpetaDatos, 'contenido');
// El instalador deja el contenido de fábrica junto al .exe (extraFiles); se copia en el primer arranque.
const contenidoDeFabrica = join(app.isPackaged ? dirname(process.execPath) : raizApp, 'contenido');
const carpetaVistas = join(raizApp, 'dist');

mkdirSync(carpetaDatos, { recursive: true });
const registrar = crearRegistro(join(carpetaDatos, 'turnero.log'));

const urlVista = (vista: Vista) => urlDesarrollo
  ? `${urlDesarrollo}/vistas/${vista}/index.html`
  : `turnero://app/vistas/${vista}/index.html`;

function dentroDe(raiz: string, ruta: string): string | null {
  const absoluta = resolve(raiz, ruta);
  const relativa = relative(raiz, absoluta);
  if (!relativa || relativa.startsWith('..') || isAbsolute(relativa)) return null;
  return existsSync(absoluta) && statSync(absoluta).isFile() ? absoluta : null;
}

const cabecerasBase = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' };
const CSP = "default-src 'self'; script-src 'self' https://www.youtube.com https://s.ytimg.com; frame-src https://www.youtube.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'";

/** Archivos de contenido con soporte de rangos: el <video> los pide por partes. */
function servirContenido(archivo: string, rango: string | null): Response {
  const tamano = statSync(archivo).size;
  const tipo = TIPOS_MIME[extname(archivo).toLowerCase()] ?? 'application/octet-stream';
  const partes = rango && /^bytes=(\d*)-(\d*)$/.exec(rango);
  if (partes && (partes[1] || partes[2])) {
    const inicio = partes[1] ? Number(partes[1]) : Math.max(0, tamano - Number(partes[2]));
    const fin = partes[1] && partes[2] ? Math.min(Number(partes[2]), tamano - 1) : tamano - 1;
    if (inicio >= tamano || inicio > fin) {
      return new Response(null, { status: 416, headers: { ...cabecerasBase, 'Content-Range': `bytes */${tamano}` } });
    }
    const cuerpo = Readable.toWeb(createReadStream(archivo, { start: inicio, end: fin })) as ReadableStream;
    return new Response(cuerpo, { status: 206, headers: {
      ...cabecerasBase, 'Content-Type': tipo, 'Accept-Ranges': 'bytes',
      'Content-Length': String(fin - inicio + 1), 'Content-Range': `bytes ${inicio}-${fin}/${tamano}`,
    } });
  }
  const cuerpo = Readable.toWeb(createReadStream(archivo)) as ReadableStream;
  return new Response(cuerpo, { headers: { ...cabecerasBase, 'Content-Type': tipo, 'Accept-Ranges': 'bytes', 'Content-Length': String(tamano) } });
}

function registrarProtocolo() {
  protocol.handle('turnero', async (solicitud) => {
    const url = new URL(solicitud.url);
    const ruta = decodeURIComponent(url.pathname);
    if (url.host === 'app' && ruta.startsWith('/contenido/')) {
      const archivo = dentroDe(carpetaContenido, ruta.slice('/contenido/'.length));
      return archivo ? servirContenido(archivo, solicitud.headers.get('range')) : new Response('No encontrado', { status: 404, headers: cabecerasBase });
    }
    const archivo = url.host === 'app' ? dentroDe(carpetaVistas, ruta.slice(1)) : null;
    if (!archivo) return new Response('No encontrado', { status: 404 });
    const respuesta = await net.fetch(pathToFileURL(archivo).toString());
    if (extname(archivo) !== '.html') return respuesta;
    // Todo es local: nada se carga de fuera del propio esquema (RNF-01).
    const cabeceras = new Headers(respuesta.headers);
    cabeceras.set('Content-Type', 'text/html; charset=utf-8');
    cabeceras.set('Content-Security-Policy', CSP);
    return new Response(respuesta.body, { status: respuesta.status, headers: cabeceras });
  });
}

async function iniciar() {
  Menu.setApplicationMenu(null);
  // Identidad de la aplicación de escritorio exigida por YouTube para páginas locales.
  session.defaultSession.webRequest.onBeforeSendHeaders({urls:['https://www.youtube.com/embed/*']}, (details, callback) => {
    callback({requestHeaders:{...details.requestHeaders, Referer:'https://mx.uaq.comal.local/'}});
  });
  registrarProtocolo();

  const rutaConfig = join(carpetaDatos, 'config.json');
  let config: Config = leerConfig(rutaConfig, registrar);
  let inventario: Inventario;
  let pantallas: Pantallas = { publica: 'ninguna' };
  const store = crearStore({ ruta: join(carpetaDatos, 'estado.json'), registrar });

  const ventanas = crearVentanas({
    preload: join(import.meta.dirname, 'preload.cjs'),
    url: urlVista,
    desarrollo,
    pantallaPreferida: () => config.pantallaPublica,
    alCambiarPantallas: (nuevas) => { pantallas = nuevas; ipc.difundirPantallas(nuevas); },
    alCerrarOperador: () => app.quit(),
    registrar,
  });

  const importarContenido = async (categoria: CategoriaContenido): Promise<ResultadoImportacion> => {
    const videos = categoria === 'videos';
    const seleccion = await dialog.showOpenDialog({
      title: videos ? 'Agregar videos a la pantalla 2' : 'Agregar imágenes a la pantalla 2',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: videos ? 'Videos compatibles' : 'Imágenes compatibles', extensions: videos ? ['mp4', 'webm'] : ['jpg', 'jpeg', 'png', 'webp'] }],
    });
    if (seleccion.canceled) return { agregados: [], omitidos: [], cancelado: true };
    const resultado = importarArchivos(carpetaContenido, categoria, seleccion.filePaths, registrar);
    if (resultado.agregados.length) registrar(`contenido: se importaron ${resultado.agregados.join(', ')}`);
    return resultado;
  };
  const quitarContenido = (url: string) => {
    const eliminado = quitarArchivo(carpetaContenido, url);
    if (eliminado) registrar(`contenido: se eliminó ${decodeURIComponent(url.split('/').pop() ?? url)}`);
    return eliminado;
  };
  const abrirCarpetaContenido = async (categoria?: CategoriaContenido) => {
    const carpeta = join(carpetaContenido, categoria ?? '');
    mkdirSync(carpeta, { recursive: true });
    const error = await shell.openPath(carpeta);
    if (error) throw new Error(`No se pudo abrir la carpeta de multimedia: ${error}`);
  };

  const ipc = conectarIpc({
    configurarYouTube: (url) => {
      const nueva = {...leerConfig(rutaConfig, registrar), youtubeUrl: url};
      writeFileSync(rutaConfig, `${JSON.stringify(nueva, null, 2)}\n`);
      config = {...config, youtubeUrl: url};
      ipc.difundirConfig(config);
    },
    store,
    inicial: () => ({ instantanea: store.obtener(), config, inventario, pantallas }),
    esOperador: ventanas.esOperador,
    destinos: ventanas.destinos,
    importarContenido,
    quitarContenido,
    abrirCarpetaContenido,
    registrar,
  });

  sembrarContenido(contenidoDeFabrica, carpetaContenido, registrar);
  const contenido = vigilarContenido(carpetaContenido, (nuevo) => { inventario = nuevo; ipc.difundirContenido(nuevo); }, registrar);
  inventario = contenido.inicial;

  // §8 · recarga diaria de la pública fuera del horario de servicio; de paso, reinicio por fecha.
  let recarga: ReturnType<typeof setTimeout> | undefined;
  const programarRecarga = () => {
    clearTimeout(recarga);
    recarga = setTimeout(() => {
      store.reiniciarSiCambioDia();
      ventanas.recargarPublica();
      programarRecarga();
    }, msHastaHora(config.recargaDiaria));
  };

  vigilarConfig(rutaConfig, (nueva) => {
    const cambioPantalla = nueva.pantallaPublica !== config.pantallaPublica;
    const cambioRecarga = nueva.recargaDiaria !== config.recargaDiaria;
    config = nueva;
    ipc.difundirConfig(nueva);
    if (cambioPantalla) ventanas.sincronizar();
    if (cambioRecarga) programarRecarga();
  }, registrar);

  app.on('second-instance', () => ventanas.enfocarOperador());
  app.on('before-quit', () => ventanas.cerrar());
  app.on('window-all-closed', () => app.quit());

  ventanas.iniciar();
  programarRecarga();
  registrar(`Turnero iniciado · datos en ${carpetaDatos}`);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(iniciar).catch(async (error: unknown) => {
    registrar(`No se pudo iniciar: ${error instanceof Error ? error.stack : String(error)}`);
    await dialog.showMessageBox({
      type: 'error',
      title: 'Turnero',
      message: 'No se pudo iniciar el turnero.',
      detail: error instanceof Error ? error.message : String(error),
    });
    app.quit();
  });
}
