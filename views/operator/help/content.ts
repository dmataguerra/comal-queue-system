export type OperatorPageId = 'turnos' | 'multimedia' | 'diagnostico';
export type TourId = 'completo' | 'llamar' | 'corregir' | 'multimedia';
export interface TourStep {
  id: string;
  page: OperatorPageId;
  target: string;
  title: string;
  text: string;
}
export interface HelpTopic {
  id: string;
  title: string;
  summary: string;
  icon: string;
  keywords: string;
  steps: string[];
  notes: string[];
  tour?: TourId;
}
export const topics: HelpTopic[] = [
  {
    id: 'llamar',
    title: 'Llamar un pedido',
    summary: 'Del número del ticket al aviso en la TV.',
    icon: 'receipt',
    keywords: 'ticket pedido anunciar repetir captura número enter',
    tour: 'llamar',
    steps: [
      'En Turnos, escribe de 1 a 6 dígitos del ticket.',
      'Pulsa Enter o Anunciar en la TV.',
      'Comprueba el número en la TV y escucha la voz.',
    ],
    notes: [
      'Solo cuentan las dos últimas cifras: 213298 → 98; 7 → 07; 1200 → 00.',
      'Para repetir, escribe el mismo número o pulsa la bocina de su fila. Se renuevan sus cinco minutos.',
      'Una llamada rechazada conserva el ticket y no cambia el turno.',
    ],
  },
  {
    id: 'corregir',
    title: 'Corregir una captura',
    summary: 'Deshacer el último llamado o quitar un número.',
    icon: 'undo',
    keywords: 'corrección corregir deshacer error quitar borrar eliminar',
    tour: 'corregir',
    steps: [
      'Para revertir el último llamado, pulsa Corregir última captura.',
      'Escribe después el número correcto.',
      'Para retirar otro número, usa la papelera de su fila y confirma.',
    ],
    notes: [
      'Corregir revierte una sola llamada, sin anunciar. Ctrl + Z solo edita el texto.',
      'Quitar elimina la corrección pendiente y los anuncios de ese turno que aún esperan. El audio iniciado puede terminar.',
      'Quitar no registra una venta ni una entrega.',
    ],
  },
  {
    id: 'multimedia',
    title: 'Agregar multimedia',
    summary: 'Videos, imágenes y contenido local para la TV.',
    icon: 'media',
    keywords: 'imágenes imagen video vídeo archivos importar youtube internet fotos banner',
    tour: 'multimedia',
    steps: [
      'Abre Multimedia en la barra lateral.',
      'Pulsa Agregar videos o Agregar imágenes y selecciona archivos completos.',
      'Espera la confirmación y revisa el resultado en la TV.',
    ],
    notes: [
      'Videos: MP4 H.264 o WebM, máximo 2 GB. 1080p es una recomendación.',
      'Imágenes: JPG, PNG o WebP, máximo 25 MB. Se recomienda 1920 × 1080.',
      'La prioridad es YouTube, videos, imágenes y bienvenida. Para dejar el enlace, pulsa Usar contenido local.',
      'En navegador YouTube no está admitido; usa archivos locales.',
    ],
  },
  {
    id: 'audio',
    title: 'Revisar el sonido',
    summary: 'Volumen, estados del audio y anuncios en espera.',
    icon: 'volume',
    keywords: 'audio voz sonido bocinas volumen cola llena anunciando anunciado silencio hdmi',
    steps: [
      'Revisa la salida y el volumen de Windows y las bocinas.',
      'Abre la bocina del encabezado, ajusta Voz y pulsa Aplicar.',
      'Prueba un número acordado y confirma que se escucha.',
    ],
    notes: [
      'Anunciado confirma que la aplicación terminó; comprueba también el sonido físico.',
      'La cola admite seis anuncios incluido el activo. Si se llena, espera y reintenta.',
      'Voz en 0% impide anunciar; por encima de 100% puede distorsionar. La multimedia baja durante los llamados.',
    ],
  },
  {
    id: 'pantalla',
    title: 'Preparar la pantalla',
    summary: 'Conectar la TV y mejorar la lectura.',
    icon: 'monitor',
    keywords:
      'tv monitor pantalla extender hdmi tamaño zoom tema azul morado desaparece cinco seis',
    steps: [
      'Enciende la TV y revisa la entrada HDMI.',
      'En Windows, pulsa Windows + P y elige Extender.',
      'Comprueba la vista pública y ajusta tamaño o tema desde el encabezado.',
    ],
    notes: [
      'Sin otra pantalla, la vista pública se abre como una ventana en la PC.',
      'Se muestran seis turnos. Otro distinto desplaza al más antiguo y cada turno vence a los cinco minutos de su última llamada.',
      'Tamaño: 70% a 130%. Escritorio y navegador guardan sus preferencias por separado.',
    ],
  },
  {
    id: 'datos',
    title: 'Cuidar los datos',
    summary: 'Guardado, respaldo y ayuda ante un fallo.',
    icon: 'folder',
    keywords:
      'datos persistencia guardar guardado disco espacio permisos respaldo restaurar diagnóstico ayuda',
    steps: [
      'En Diagnósticos, revisa el guardado, espacio y Carpeta de datos.',
      'Para respaldar, cierra Comal++ y copia esa carpeta completa a otra unidad.',
      'Para restaurar, pide apoyo al responsable y conserva los datos actuales.',
    ],
    notes: [
      'Si falla el guardado, la acción no se aplica ni se anuncia. Resuelve espacio o permisos y reintenta.',
      'Al reiniciar solo vuelven los turnos del día que no vencieron. No se repiten audios antiguos.',
      'Después de restaurar, comprueba versión, TV, voz y contenido antes de atender.',
    ],
  },
];
const call: TourStep[] = [
  {
    id: 'ticket',
    page: 'turnos',
    target: '[data-help="ticket"]',
    title: 'Escribe el ticket',
    text: 'Aquí se capturan de 1 a 6 dígitos. Solo se anuncian las dos últimas cifras: 213298 se muestra como 98.',
  },
  {
    id: 'anunciar',
    page: 'turnos',
    target: '[data-help="anunciar"]',
    title: 'Anuncia el pedido listo',
    text: 'Durante la operación, Enter o este botón llaman el pedido. Este recorrido solo explica los controles: no envía anuncios.',
  },
  {
    id: 'resultado',
    page: 'turnos',
    target: '[data-help="en-pantalla"]',
    title: 'Revisa el resultado',
    text: 'Aquí aparecen hasta seis turnos y el estado de su audio. Anunciado confirma el final de la reproducción; comprueba también las bocinas.',
  },
];
const fix: TourStep[] = [
  {
    id: 'corregir',
    page: 'turnos',
    target: '[data-help="corregir"]',
    title: 'Corrige el último llamado',
    text: 'Corregir última captura revierte una sola llamada, sin anunciar. Puede estar deshabilitado si no hay nada que corregir.',
  },
  {
    id: 'acciones',
    page: 'turnos',
    target: '[data-help="en-pantalla"]',
    title: 'Repetir o quitar un turno',
    text: 'La bocina de cada fila repite y la papelera retira el número. Ambas acciones piden confirmación. Si la lista está vacía, aquí aparecerán sus filas.',
  },
];
const media: TourStep[] = [
  {
    id: 'biblioteca',
    page: 'multimedia',
    target: '.media-library-layout',
    title: 'Agrega archivos locales',
    text: 'Agregar videos e imágenes abre el selector de archivos durante la operación. Espera el mensaje y revisa la TV. En este recorrido no se abren selectores ni se cambian archivos.',
  },
  {
    id: 'youtube',
    page: 'multimedia',
    target: '.youtube-form',
    title: 'Elige la fuente',
    text: 'En escritorio puedes usar YouTube con internet o volver al contenido local. En navegador solo está admitido el contenido local. Los pedidos y sus voces funcionan sin internet.',
  },
];
export const tours: Record<
  TourId,
  {
    titulo: string;
    resumen: string;
    pasos: TourStep[];
  }
> = {
  completo: {
    titulo: 'Conocer Comal++',
    resumen: 'Llamados, corrección y multimedia.',
    pasos: [...call, ...fix, ...media],
  },
  llamar: { titulo: 'Llamar', resumen: 'Ticket, anuncio y resultado.', pasos: call },
  corregir: { titulo: 'Corregir', resumen: 'Última captura y acciones de fila.', pasos: fix },
  multimedia: {
    titulo: 'Multimedia',
    resumen: 'Archivos locales y fuente de contenido.',
    pasos: media,
  },
};
export function normalizeSearch(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}
export function searchTopics(query: string) {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return topics.filter((topic) => {
    const text = normalizeSearch(
      [topic.title, topic.summary, topic.keywords, ...topic.steps, ...topic.notes].join(' '),
    );
    return words.every((word) => text.includes(word));
  });
}
