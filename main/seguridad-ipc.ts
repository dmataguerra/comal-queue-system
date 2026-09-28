import type { Accion, CategoriaContenido, EntregaAudio } from '../shared/contract.js';

export function validarAcuseAudio(
  valor: unknown,
): [number, number, Exclude<EntregaAudio['estado'], 'pendiente'>] {
  if (!Array.isArray(valor) || valor.length !== 3) throw new Error('Acuse de audio inválido.');
  const [id, n, estado] = valor as unknown[];
  if (
    !Number.isSafeInteger(id) ||
    (id as number) < 1 ||
    !Number.isInteger(n) ||
    (n as number) < 0 ||
    (n as number) > 99 ||
    (estado !== 'reproduciendo' &&
      estado !== 'reproducido' &&
      estado !== 'fallo' &&
      estado !== 'descartado')
  )
    throw new Error('Acuse de audio inválido.');
  return [id as number, n as number, estado];
}
import { esYouTube } from '../nucleo/youtube.js';

type Vista = 'operador' | 'publica';

interface Remitente {
  getURL(): string;
  mainFrame: { url: string };
}

interface Evento {
  sender: Remitente;
  senderFrame: { url: string } | null;
}

/** Exige la ventana registrada, su marco principal y la página local prevista. */
export function autorizarIpc<T extends Remitente>(
  evento: Evento & { sender: T },
  vista: Vista | 'cualquiera',
  esOperador: (remitente: T) => boolean,
  esPublica: (remitente: T) => boolean,
  urlVista: (vista: Vista) => string,
): Vista {
  const remitente = evento.sender;
  const origen = esOperador(remitente) ? 'operador' : esPublica(remitente) ? 'publica' : null;
  if (!origen || (vista !== 'cualquiera' && origen !== vista))
    throw new Error('Vista no autorizada.');
  const principal = remitente.mainFrame;
  if (!principal || evento.senderFrame !== principal) throw new Error('Marco no autorizado.');
  const esperada = urlVista(origen);
  if (remitente.getURL() !== esperada || principal.url !== esperada)
    throw new Error('Página no autorizada.');
  return origen;
}

export function validarSinArgumentos(argumentosIpc: unknown[]): void {
  if (argumentosIpc.length !== 0) throw new Error('Argumentos no válidos.');
}

export function validarCantidad(argumentosIpc: unknown[], cantidad: number): void {
  if (argumentosIpc.length !== cantidad) throw new Error('Argumentos no válidos.');
}

export function validarAccion(accion: unknown): Accion {
  if (!accion || typeof accion !== 'object' || Array.isArray(accion))
    throw new Error('Acción no válida.');
  const valor = accion as Record<string, unknown>;
  if (valor.tipo === 'DESHACER') return { tipo: 'DESHACER' };
  if (valor.tipo === 'LLAMAR' && typeof valor.entrada === 'string' && valor.entrada.length <= 32)
    return { tipo: 'LLAMAR', entrada: valor.entrada };
  if (
    valor.tipo === 'QUITAR' &&
    Number.isInteger(valor.n) &&
    (valor.n as number) >= 0 &&
    (valor.n as number) <= 99
  )
    return { tipo: 'QUITAR', n: valor.n as number };
  throw new Error('Acción no válida.');
}

export function validarYouTube(url: unknown): string | null {
  if (url === null || esYouTube(url)) return url;
  throw new Error('Enlace de YouTube no válido.');
}

export function validarCategoria(categoria: unknown): CategoriaContenido {
  if (categoria === 'videos' || categoria === 'banner') return categoria;
  throw new Error('Categoría multimedia no válida.');
}

export function validarCategoriaOpcional(categoria: unknown): CategoriaContenido | undefined {
  return categoria === undefined ? undefined : validarCategoria(categoria);
}

export function validarUrlContenido(valor: unknown): string {
  if (typeof valor !== 'string' || valor.length > 1000)
    throw new Error('Archivo multimedia no válido.');
  try {
    const url = new URL(valor);
    if (url.protocol !== 'turnero:' || url.host !== 'app' || url.search || url.hash)
      throw new Error('URL no permitida.');
    const partes = url.pathname.split('/');
    if (
      partes.length !== 4 ||
      partes[1] !== 'contenido' ||
      !['videos', 'banner'].includes(partes[2])
    )
      throw new Error('Categoría no permitida.');
    const nombre = decodeURIComponent(partes[3]);
    if (
      !nombre ||
      nombre === '.' ||
      nombre === '..' ||
      [...nombre].some(
        (caracter) => caracter === '/' || caracter === '\\' || caracter.charCodeAt(0) < 32,
      )
    )
      throw new Error('Nombre no permitido.');
    return valor;
  } catch {
    throw new Error('Archivo multimedia no válido.');
  }
}

export function validarVolumen(volumen: unknown, rampa: unknown): [number, number] {
  if (typeof volumen !== 'number' || !Number.isFinite(volumen) || volumen < 0 || volumen > 1)
    throw new Error('Volumen no válido.');
  if (typeof rampa !== 'number' || !Number.isFinite(rampa) || rampa < 0 || rampa > 2000)
    throw new Error('Rampa no válida.');
  return [volumen, rampa];
}

export function validarMensaje(mensaje: unknown): string {
  if (typeof mensaje !== 'string' || mensaje.length > 500)
    throw new Error('Mensaje de registro no válido.');
  return mensaje;
}

export function validarSalud(
  tipo: unknown,
  estado: unknown,
): ['audio' | 'youtube', 'correcto' | 'degradado'] {
  if (tipo !== 'audio' && tipo !== 'youtube') throw new Error('Tipo de salud no válido.');
  if (estado !== 'correcto' && estado !== 'degradado')
    throw new Error('Estado de salud no válido.');
  return [tipo, estado];
}
export function validarVolumenes(voz: unknown, multimedia: unknown): [number, number] {
  if (
    typeof voz !== 'number' ||
    !Number.isFinite(voz) ||
    voz < 0 ||
    voz > 3 ||
    typeof multimedia !== 'number' ||
    !Number.isFinite(multimedia) ||
    multimedia < 0 ||
    multimedia > 1
  )
    throw new Error('Volumen inválido.');
  return [voz, multimedia];
}
