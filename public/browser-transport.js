if (!window.turnero) {
  const listeners = {
    estado: new Set(),
    config: new Set(),
    contenido: new Set(),
    pantallas: new Set(),
    entregaAudio: new Set(),
  };
  const notify = (type, ...data) => listeners[type]?.forEach((fn) => fn(...data));
  const listen = (type, fn) => {
    listeners[type].add(fn);
    return () => listeners[type].delete(fn);
  };
  async function request(path, payload) {
    const options =
      payload === undefined
        ? {}
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Turnero-Cliente': 'navegador' },
            body: JSON.stringify(payload),
          };
    const response = await fetch(path, options);
    const result = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(result.error || 'No se pudo comunicar con el turnero.'), {
        code: result.code || 'INTERNAL',
      });
    return result;
  }
  const eventSource = new EventSource('/api/events');
  eventSource.onmessage = (messageEvent) => {
    const { tipo: type, datos: data } = JSON.parse(messageEvent.data);
    notify(type, ...data);
  };
  eventSource.onopen = async () => {
    try {
      const {
        instantanea: snapshot,
        revision,
        config,
        inventario: inventory,
        pantallas: displays,
        entregaAudio: audioDelivery,
        entregasAudio: audioDeliveries,
      } = await request('/api/inicial');
      // The revision lets the page ignore this snapshot if a newer event already arrived.
      notify('estado', snapshot, null, revision);
      notify('config', config);
      notify('contenido', inventory);
      notify('pantallas', displays);
      if (audioDelivery) notify('entregaAudio', audioDelivery);
      for (const delivery of audioDeliveries ?? []) notify('entregaAudio', delivery);
    } catch {
      /* La conexión se recupera con el siguiente intento de EventSource. */
    }
  };
  window.turnero = {
    youtubeAdmitido: false,
    obtener: () => request('/api/inicial'),
    diagnostico: () => request('/api/diagnostico'),
    despachar: (action) => request('/api/accion', action),
    configurarYouTube: (url) => request('/api/youtube', url),
    configurarVolumen: (voice, media) => request('/api/volumen', [voice, media]),
    importarContenido: (category) => request('/api/contenido/importar', category),
    quitarContenido: (url) => request('/api/contenido/quitar', url),
    abrirCarpetaContenido: (category) => request('/api/contenido/abrir', category ?? null),
    abrirManual: async () => {
      const response = await fetch('/manual/manual-usuario-0.4.0.pdf');
      if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'application/pdf')
        throw new Error('No se encontró el manual PDF. Consulta al responsable.');
      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Comal++_Manual_de_usuario_0.4.0.pdf';
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    },
    ajustarVolumenYouTube: async () => {
      throw new Error(
        'YouTube no está admitido en navegador. Usa la aplicación de escritorio o contenido local.',
      );
    },
    informarSalud: (type, state) => {
      void request('/api/salud', [type, state]).catch(console.error);
    },
    confirmarAnuncio: (id, n, state) => request('/api/audio', [id, n, state]),
    alCambiarEstado: (fn) => listen('estado', fn),
    alCambiarConfig: (fn) => listen('config', fn),
    alCambiarContenido: (fn) => listen('contenido', fn),
    alCambiarPantallas: (fn) => listen('pantallas', fn),
    alCambiarEntregaAudio: (fn) => listen('entregaAudio', fn),
    registrar: (message, level) => {
      void request('/api/registro', [message, level ?? 'warn']).catch(console.error);
    },
  };
}
