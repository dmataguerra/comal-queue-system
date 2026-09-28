import { app, dialog, Menu, protocol, shell, session } from 'electron';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { migrarDatosDocumentos, resolverCarpetaDatos } from './carpeta-datos.js';
import { conectarIpc } from './adaptador-ipc.js';
import { leerConfig, msHastaHora, vigilarConfig } from './config.js';
import {
  importarArchivos,
  quitarArchivo,
  sembrarContenido,
  vigilarContenido,
} from './contenido.js';
import type {
  CategoriaContenido,
  Config,
  EntregaAudio,
  Inventario,
  Pantallas,
  ResultadoImportacion,
} from '../shared/contract.js';
import { crearRegistro } from './log.js';
import { crearProveedorDiagnostico } from './diagnostico.js';
import { limpiarTemporalesJson } from './temporales.js';
import { crearCsp } from './politica-csp.js';
import { registerContentProtocol } from './content-protocol.js';
import { escribirJsonAtomico } from './escritura-atomica.js';
import { crearStore } from './store.js';
import { crearVentanas, type Vista } from './ventanas.js';
import { crearServidorWeb } from './servidor-web.js';
import { migrarDesde02 } from './migracion-02.js';

// Debe registrarse antes de `ready`. `stream` permite servir video por rangos.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'turnero',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

const desarrollo = !app.isPackaged;
const urlDesarrollo = process.env.TURNERO_DEV_URL;
const raizApp = app.getAppPath();
// Datos privados en el perfil de la aplicación, fuera de Documentos/OneDrive y del instalador.
const carpetaDatos = resolverCarpetaDatos({
  personalizada: process.env.TURNERO_DATOS,
  empaquetada: app.isPackaged,
  perfil: app.getPath('userData'),
  raiz: raizApp,
});
const carpetaContenido = join(carpetaDatos, 'contenido');
// El instalador deja el contenido de fábrica junto al .exe (extraFiles); se copia en el primer arranque.
const contenidoDeFabrica = join(app.isPackaged ? dirname(process.execPath) : raizApp, 'contenido');
const carpetaVistas = join(raizApp, 'dist');

let ultimoErrorAplicacion: string | null = null;
let registroBase: (mensaje: string) => void = (mensaje) => console.error(mensaje);
const registrar = (mensaje: string) => {
  if (/error|fall|no se pudo|falta|rechazad|terminó/i.test(mensaje))
    ultimoErrorAplicacion = mensaje.slice(0, 200);
  registroBase(mensaje);
};

const urlVista = (vista: Vista) =>
  urlDesarrollo
    ? `${urlDesarrollo}/vistas/${vista}/index.html`
    : `turnero://app/vistas/${vista}/index.html`;

async function iniciar() {
  // Preparar la carpeta dentro del mismo manejador que muestra errores de arranque.
  const migrados =
    app.isPackaged && !process.env.TURNERO_DATOS
      ? migrarDatosDocumentos(join(app.getPath('documents'), 'Turnero Comal'), carpetaDatos)
      : false;
  mkdirSync(carpetaDatos, { recursive: true });
  registroBase = crearRegistro(join(carpetaDatos, 'turnero.log'), {
    version: app.getVersion(),
  });
  if (migrados)
    registrar(`Datos copiados desde Documentos a ${carpetaDatos}; originales conservados.`);
  limpiarTemporalesJson(carpetaDatos, registrar);
  Menu.setApplicationMenu(null);
  // Una página de Vite con el mismo ETag puede conservar una CSP antigua en el perfil.
  // Limpiar solo la caché HTTP permite aplicar la política vigente al reiniciar desarrollo.
  if (urlDesarrollo) await session.defaultSession.clearCache();
  // Identidad de la aplicación de escritorio exigida por YouTube para páginas locales.
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://www.youtube.com/embed/*'] },
    (details, callback) => {
      callback({
        requestHeaders: { ...details.requestHeaders, Referer: 'https://mx.uaq.comal.local/' },
      });
    },
  );
  registerContentProtocol({
    contentRoot: carpetaContenido,
    viewsRoot: carpetaVistas,
    developmentUrl: urlDesarrollo,
    contentSecurityPolicy: crearCsp(false),
  });

  const rutaConfig = join(carpetaDatos, 'config.json');
  migrarDesde02(join(app.getPath('userData'), 'comal.sqlite'), carpetaDatos, registrar);
  let config: Config = leerConfig(rutaConfig, registrar);
  let inventario: Inventario;
  let pantallas: Pantallas = { publica: 'ninguna' };
  const store = crearStore({ ruta: join(carpetaDatos, 'estado.json'), registrar });
  let saludAudio: 'correcto' | 'degradado' | 'desconocido' = 'desconocido';
  let saludYouTube: 'activo' | 'no disponible' | 'inactivo' = 'inactivo';
  let entregaAudio: EntregaAudio | null = null;
  const entregasAudio = new Map<number, EntregaAudio>();
  let servidorWeb: Awaited<ReturnType<typeof crearServidorWeb>> | null = null;

  const ventanas = crearVentanas({
    preload: join(import.meta.dirname, 'preload.cjs'),
    url: urlVista,
    desarrollo,
    pantallaPreferida: () => config.pantallaPublica,
    alCambiarPantallas: (nuevas) => {
      pantallas = nuevas;
      ipc.difundirPantallas(nuevas);
      servidorWeb?.difundirPantallas(nuevas);
    },
    alCerrarOperador: () => app.quit(),
    registrar,
  });

  const importarContenido = async (
    categoria: CategoriaContenido,
  ): Promise<ResultadoImportacion> => {
    const videos = categoria === 'videos';
    const seleccion = await dialog.showOpenDialog({
      title: videos ? 'Agregar videos a la pantalla 2' : 'Agregar imágenes a la pantalla 2',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: videos ? 'Videos compatibles' : 'Imágenes compatibles',
          extensions: videos ? ['mp4', 'webm'] : ['jpg', 'jpeg', 'png', 'webp'],
        },
        { name: 'Todos los archivos', extensions: ['*'] },
      ],
    });
    if (seleccion.canceled) return { agregados: [], omitidos: [], cancelado: true };
    const resultado = importarArchivos(carpetaContenido, categoria, seleccion.filePaths, registrar);
    if (resultado.agregados.length)
      registrar(`contenido: se importaron ${resultado.agregados.join(', ')}`);
    return resultado;
  };
  const quitarContenido = (url: string) => {
    const eliminado = quitarArchivo(carpetaContenido, url);
    if (eliminado)
      registrar(`contenido: se eliminó ${decodeURIComponent(url.split('/').pop() ?? url)}`);
    return eliminado;
  };
  const abrirCarpetaContenido = async (categoria?: CategoriaContenido) => {
    const carpeta = join(carpetaContenido, categoria ?? '');
    mkdirSync(carpeta, { recursive: true });
    const error = await shell.openPath(carpeta);
    if (error) throw new Error(`No se pudo abrir la carpeta de multimedia: ${error}`);
  };

  const diagnostico = crearProveedorDiagnostico({
    carpetaDatos,
    version: app.getVersion(),
    store,
    config: () => config,
    inventario: () => inventario,
    pantallas: () => pantallas,
    ventanas: ventanas.estadoVentanas,
    salud: () => ({ audio: saludAudio, youtube: saludYouTube, ultimoErrorAplicacion }),
  });
  const configurarYouTube = (url: string | null) => {
    const nueva = { ...leerConfig(rutaConfig, registrar), youtubeUrl: url };
    try {
      escribirJsonAtomico(rutaConfig, nueva, 2);
    } catch (error) {
      registrar(`No se pudo guardar config.json: ${(error as Error).message}`);
      throw error;
    }
    config = { ...config, youtubeUrl: url };
    ipc.difundirConfig(config);
    servidorWeb?.difundirConfig(config);
  };

  const configurarVolumen = (voz: number, multimedia: number) => {
    const nueva = {
      ...leerConfig(rutaConfig, registrar),
      volumenVoz: voz,
      volumenMusica: multimedia,
    };
    escribirJsonAtomico(rutaConfig, nueva, 2);
    config = { ...config, volumenVoz: voz, volumenMusica: multimedia };
    ipc.difundirConfig(config);
    servidorWeb?.difundirConfig(config);
  };
  const ipc = conectarIpc({
    configurarVolumen,
    diagnostico,
    informarSalud: (tipo, estado) => {
      if (tipo === 'audio') {
        const siguiente = estado === 'correcto' ? 'correcto' : 'degradado';
        if (saludAudio !== siguiente) {
          registrar(siguiente === 'correcto' ? 'Audio recuperado.' : 'Audio degradado.');
          saludAudio = siguiente;
        }
      } else {
        const siguiente = estado === 'correcto' ? 'activo' : 'no disponible';
        if (saludYouTube !== siguiente) {
          registrar(siguiente === 'activo' ? 'YouTube recuperado.' : 'YouTube no disponible.');
          saludYouTube = siguiente;
        }
      }
    },
    confirmarAnuncio: (id, n, estado) => {
      const anterior = entregasAudio.get(n);
      if (
        !anterior ||
        anterior.id !== id ||
        (anterior.estado !== 'pendiente' && anterior.estado !== 'reproduciendo')
      )
        return;
      entregaAudio = { ...anterior, estado, fecha: new Date().toISOString() };
      entregasAudio.set(n, entregaAudio);
      ipc.difundirEntregaAudio(entregaAudio);
      servidorWeb?.difundirEntregaAudio(entregaAudio);
      registrar(`Audio del turno ${n}: ${estado} por la vista pública.`);
    },
    configurarYouTube,
    store,
    inicial: () => ({
      instantanea: store.obtener(),
      config,
      inventario,
      pantallas,
      entregaAudio,
      entregasAudio: [...entregasAudio.values()],
    }),
    esOperador: ventanas.esOperador,
    esPublica: ventanas.esPublica,
    urlVista,
    destinos: ventanas.destinos,
    importarContenido,
    quitarContenido,
    abrirCarpetaContenido,
    registrar,
  });
  store.suscribir((_instantanea, anuncio) => {
    const visibles = [_instantanea.actual, ..._instantanea.llamados];
    for (const n of entregasAudio.keys()) if (!visibles.includes(n)) entregasAudio.delete(n);
    if (!anuncio) return;
    entregaAudio = {
      id: anuncio.id,
      n: anuncio.n,
      estado: 'pendiente',
      fecha: new Date().toISOString(),
    };
    entregasAudio.set(anuncio.n, entregaAudio);
    ipc.difundirEntregaAudio(entregaAudio);
    servidorWeb?.difundirEntregaAudio(entregaAudio);
  });

  sembrarContenido(contenidoDeFabrica, carpetaContenido, registrar);
  const contenido = vigilarContenido(
    carpetaContenido,
    (nuevo) => {
      inventario = nuevo;
      ipc.difundirContenido(nuevo);
      servidorWeb?.difundirContenido(nuevo);
    },
    registrar,
  );
  inventario = contenido.inicial;

  // §8 · recarga diaria de la pública fuera del horario de servicio; de paso, reinicio por fecha.
  let recarga: ReturnType<typeof setTimeout> | undefined;
  const programarRecarga = () => {
    clearTimeout(recarga);
    recarga = setTimeout(() => {
      try {
        store.reiniciarSiCambioDia();
        ventanas.recargarPublica();
      } catch (error) {
        registrar(`No se pudo reiniciar la jornada: ${(error as Error).message}`);
      } finally {
        programarRecarga();
      }
    }, msHastaHora(config.recargaDiaria));
  };

  const detenerConfig = vigilarConfig(
    rutaConfig,
    (nueva) => {
      const cambioPantalla = nueva.pantallaPublica !== config.pantallaPublica;
      const cambioRecarga = nueva.recargaDiaria !== config.recargaDiaria;
      config = nueva;
      ipc.difundirConfig(nueva);
      servidorWeb?.difundirConfig(nueva);
      if (cambioPantalla) ventanas.sincronizar();
      if (cambioRecarga) programarRecarga();
    },
    registrar,
  );

  app.on('second-instance', () => ventanas.enfocarOperador());
  app.on('before-quit', () => {
    detenerConfig();
    contenido.detener();
    clearTimeout(recarga);
    store.cerrar();
    servidorWeb?.cerrar();
    ventanas.cerrar();
  });
  app.on('window-all-closed', () => app.quit());

  ventanas.iniciar();
  try {
    servidorWeb = await crearServidorWeb({
      vistas: carpetaVistas,
      contenido: carpetaContenido,
      store,
      inicial: () => ({
        instantanea: store.obtener(),
        config,
        inventario,
        pantallas,
        entregaAudio,
        entregasAudio: [...entregasAudio.values()],
      }),
      diagnostico,
      configurarYouTube,
      configurarVolumen,
      importarContenido,
      quitarContenido,
      abrirCarpetaContenido,
      confirmarAnuncio: (id, n, estado) => {
        const anterior = entregasAudio.get(n);
        if (
          !anterior ||
          anterior.id !== id ||
          (anterior.estado !== 'pendiente' && anterior.estado !== 'reproduciendo')
        )
          return;
        entregaAudio = { ...anterior, estado, fecha: new Date().toISOString() };
        entregasAudio.set(n, entregaAudio);
        ipc.difundirEntregaAudio(entregaAudio);
        servidorWeb?.difundirEntregaAudio(entregaAudio);
        registrar(`Audio del turno ${n}: ${estado} por la vista pública.`);
      },
      registrar,
    });
    registrar(`Navegador local: ${servidorWeb.origen} y ${servidorWeb.origen}/publica`);
  } catch (error) {
    registrar(`No se pudo iniciar el navegador local: ${(error as Error).message}`);
  }
  programarRecarga();
  registrar(`Turnero iniciado · datos en ${carpetaDatos}`);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app
    .whenReady()
    .then(iniciar)
    .catch(async (error: unknown) => {
      const detalle = error instanceof Error ? error.message : String(error);
      registrar(`No se pudo iniciar: ${error instanceof Error ? error.stack : detalle}`);
      try {
        await dialog.showMessageBox({
          type: 'error',
          title: 'Turnero',
          message: 'No se pudo iniciar el turnero.',
          detail: `${detalle}\n\nCarpeta de datos: ${carpetaDatos}. Revise permisos, ruta y espacio disponible.`,
        });
      } catch (dialogError) {
        console.error('No se pudo mostrar el diagnóstico de arranque:', dialogError);
      } finally {
        app.quit();
      }
    });
}
