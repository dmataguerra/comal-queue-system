export type PaginaOperador = 'turnos' | 'multimedia' | 'diagnostico';
export type RecorridoId = 'completo' | 'llamar' | 'corregir' | 'multimedia';
export interface PasoRecorrido {
  id: string;
  pagina: PaginaOperador;
  objetivo: string;
  titulo: string;
  texto: string;
}
export interface TemaAyuda {
  id: string;
  titulo: string;
  resumen: string;
  icono: string;
  palabras: string;
  pasos: string[];
  notas: string[];
  recorrido?: RecorridoId;
}

export const temas: TemaAyuda[] = [
  {
    id: 'llamar',
    titulo: 'Llamar un pedido',
    resumen: 'Del número del ticket al aviso en la TV.',
    icono: 'receipt',
    palabras: 'ticket pedido anunciar repetir captura número enter',
    recorrido: 'llamar',
    pasos: [
      'En Turnos, escribe de 1 a 6 dígitos del ticket.',
      'Pulsa Enter o Anunciar en la TV.',
      'Comprueba el número en la TV y escucha la voz.',
    ],
    notas: [
      'Solo cuentan las dos últimas cifras: 213298 → 98; 7 → 07; 1200 → 00.',
      'Para repetir, escribe el mismo número o pulsa la bocina de su fila. Se renuevan sus cinco minutos.',
      'Una llamada rechazada conserva el ticket y no cambia el turno.',
    ],
  },
  {
    id: 'corregir',
    titulo: 'Corregir una captura',
    resumen: 'Deshacer el último llamado o quitar un número.',
    icono: 'undo',
    palabras: 'corrección corregir deshacer error quitar borrar eliminar',
    recorrido: 'corregir',
    pasos: [
      'Para revertir el último llamado, pulsa Corregir última captura.',
      'Escribe después el número correcto.',
      'Para retirar otro número, usa la papelera de su fila y confirma.',
    ],
    notas: [
      'Corregir revierte una sola llamada, sin anunciar. Ctrl + Z solo edita el texto.',
      'Quitar elimina la corrección pendiente y los anuncios de ese turno que aún esperan. El audio iniciado puede terminar.',
      'Quitar no registra una venta ni una entrega.',
    ],
  },
  {
    id: 'multimedia',
    titulo: 'Agregar multimedia',
    resumen: 'Videos, imágenes y contenido local para la TV.',
    icono: 'media',
    palabras: 'imágenes imagen video vídeo archivos importar youtube internet fotos banner',
    recorrido: 'multimedia',
    pasos: [
      'Abre Multimedia en la barra lateral.',
      'Pulsa Agregar videos o Agregar imágenes y selecciona archivos completos.',
      'Espera la confirmación y revisa el resultado en la TV.',
    ],
    notas: [
      'Videos: MP4 H.264 o WebM, máximo 2 GB. 1080p es una recomendación.',
      'Imágenes: JPG, PNG o WebP, máximo 25 MB. Se recomienda 1920 × 1080.',
      'La prioridad es YouTube, videos, imágenes y bienvenida. Para dejar el enlace, pulsa Usar contenido local.',
      'En navegador YouTube no está admitido; usa archivos locales.',
    ],
  },
  {
    id: 'audio',
    titulo: 'Revisar el sonido',
    resumen: 'Volumen, estados del audio y anuncios en espera.',
    icono: 'volume',
    palabras: 'audio voz sonido bocinas volumen cola llena anunciando anunciado silencio hdmi',
    pasos: [
      'Revisa la salida y el volumen de Windows y las bocinas.',
      'Abre la bocina del encabezado, ajusta Voz y pulsa Aplicar.',
      'Prueba un número acordado y confirma que se escucha.',
    ],
    notas: [
      'Anunciado confirma que la aplicación terminó; comprueba también el sonido físico.',
      'La cola admite seis anuncios incluido el activo. Si se llena, espera y reintenta.',
      'Voz en 0% impide anunciar; por encima de 100% puede distorsionar. La multimedia baja durante los llamados.',
    ],
  },
  {
    id: 'pantalla',
    titulo: 'Preparar la pantalla',
    resumen: 'Conectar la TV y mejorar la lectura.',
    icono: 'monitor',
    palabras:
      'tv monitor pantalla extender hdmi tamaño zoom tema azul morado desaparece cinco seis',
    pasos: [
      'Enciende la TV y revisa la entrada HDMI.',
      'En Windows, pulsa Windows + P y elige Extender.',
      'Comprueba la vista pública y ajusta tamaño o tema desde el encabezado.',
    ],
    notas: [
      'Sin otra pantalla, la vista pública se abre como una ventana en la PC.',
      'Se muestran seis turnos. Otro distinto desplaza al más antiguo y cada turno vence a los cinco minutos de su última llamada.',
      'Tamaño: 70% a 130%. Escritorio y navegador guardan sus preferencias por separado.',
    ],
  },
  {
    id: 'datos',
    titulo: 'Cuidar los datos',
    resumen: 'Guardado, respaldo y ayuda ante un fallo.',
    icono: 'folder',
    palabras:
      'datos persistencia guardar guardado disco espacio permisos respaldo restaurar diagnóstico ayuda',
    pasos: [
      'En Diagnósticos, revisa el guardado, espacio y Carpeta de datos.',
      'Para respaldar, cierra Comal++ y copia esa carpeta completa a otra unidad.',
      'Para restaurar, pide apoyo al responsable y conserva los datos actuales.',
    ],
    notas: [
      'Si falla el guardado, la acción no se aplica ni se anuncia. Resuelve espacio o permisos y reintenta.',
      'Al reiniciar solo vuelven los turnos del día que no vencieron. No se repiten audios antiguos.',
      'Después de restaurar, comprueba versión, TV, voz y contenido antes de atender.',
    ],
  },
];

const llamar: PasoRecorrido[] = [
  {
    id: 'ticket',
    pagina: 'turnos',
    objetivo: '[data-help="ticket"]',
    titulo: 'Escribe el ticket',
    texto:
      'Aquí se capturan de 1 a 6 dígitos. Solo se anuncian las dos últimas cifras: 213298 se muestra como 98.',
  },
  {
    id: 'anunciar',
    pagina: 'turnos',
    objetivo: '[data-help="anunciar"]',
    titulo: 'Anuncia el pedido listo',
    texto:
      'Durante la operación, Enter o este botón llaman el pedido. Este recorrido solo explica los controles: no envía anuncios.',
  },
  {
    id: 'resultado',
    pagina: 'turnos',
    objetivo: '[data-help="en-pantalla"]',
    titulo: 'Revisa el resultado',
    texto:
      'Aquí aparecen hasta seis turnos y el estado de su audio. Anunciado confirma el final de la reproducción; comprueba también las bocinas.',
  },
];
const corregir: PasoRecorrido[] = [
  {
    id: 'corregir',
    pagina: 'turnos',
    objetivo: '[data-help="corregir"]',
    titulo: 'Corrige el último llamado',
    texto:
      'Corregir última captura revierte una sola llamada, sin anunciar. Puede estar deshabilitado si no hay nada que corregir.',
  },
  {
    id: 'acciones',
    pagina: 'turnos',
    objetivo: '[data-help="en-pantalla"]',
    titulo: 'Repetir o quitar un turno',
    texto:
      'La bocina de cada fila repite y la papelera retira el número. Ambas acciones piden confirmación. Si la lista está vacía, aquí aparecerán sus filas.',
  },
];
const multimedia: PasoRecorrido[] = [
  {
    id: 'biblioteca',
    pagina: 'multimedia',
    objetivo: '.media-library-layout',
    titulo: 'Agrega archivos locales',
    texto:
      'Agregar videos e imágenes abre el selector de archivos durante la operación. Espera el mensaje y revisa la TV. En este recorrido no se abren selectores ni se cambian archivos.',
  },
  {
    id: 'youtube',
    pagina: 'multimedia',
    objetivo: '.youtube-form',
    titulo: 'Elige la fuente',
    texto:
      'En escritorio puedes usar YouTube con internet o volver al contenido local. En navegador solo está admitido el contenido local. Los pedidos y sus voces funcionan sin internet.',
  },
];

export const recorridos: Record<
  RecorridoId,
  { titulo: string; resumen: string; pasos: PasoRecorrido[] }
> = {
  completo: {
    titulo: 'Conocer Comal++',
    resumen: 'Llamados, corrección y multimedia.',
    pasos: [...llamar, ...corregir, ...multimedia],
  },
  llamar: { titulo: 'Llamar', resumen: 'Ticket, anuncio y resultado.', pasos: llamar },
  corregir: { titulo: 'Corregir', resumen: 'Última captura y acciones de fila.', pasos: corregir },
  multimedia: {
    titulo: 'Multimedia',
    resumen: 'Archivos locales y fuente de contenido.',
    pasos: multimedia,
  },
};

export function normalizarBusqueda(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}
export function buscarTemas(consulta: string) {
  const palabras = normalizarBusqueda(consulta).split(/\s+/).filter(Boolean);
  return temas.filter((tema) => {
    const texto = normalizarBusqueda(
      [tema.titulo, tema.resumen, tema.palabras, ...tema.pasos, ...tema.notas].join(' '),
    );
    return palabras.every((palabra) => texto.includes(palabra));
  });
}
