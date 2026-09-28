// El preload de Electron ya proporciona esta API; este adaptador solo corre en el navegador local.
if (!window.turnero) {
  const oyentes = {
    estado: new Set(),
    config: new Set(),
    contenido: new Set(),
    pantallas: new Set(),
    entregaAudio: new Set(),
  };
  const avisar = (tipo, ...datos) => oyentes[tipo]?.forEach((fn) => fn(...datos));
  const escuchar = (tipo, fn) => {
    oyentes[tipo].add(fn);
    return () => oyentes[tipo].delete(fn);
  };
  async function solicitar(ruta, dato) {
    const opciones =
      dato === undefined
        ? {}
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Turnero-Cliente': 'navegador' },
            body: JSON.stringify(dato),
          };
    const respuesta = await fetch(ruta, opciones);
    const resultado = await respuesta.json();
    if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo comunicar con el turnero.');
    return resultado;
  }
  const eventos = new EventSource('/api/events');
  eventos.onmessage = (evento) => {
    const { tipo, datos } = JSON.parse(evento.data);
    avisar(tipo, ...datos);
  };
  eventos.onopen = async () => {
    try {
      const { instantanea, config, inventario, pantallas, entregaAudio, entregasAudio } =
        await solicitar('/api/inicial');
      avisar('estado', instantanea, null);
      avisar('config', config);
      avisar('contenido', inventario);
      avisar('pantallas', pantallas);
      if (entregaAudio) avisar('entregaAudio', entregaAudio);
      for (const entrega of entregasAudio ?? []) avisar('entregaAudio', entrega);
    } catch {
      /* La conexión se reintentará. */
    }
  };
  window.turnero = {
    obtener: () => solicitar('/api/inicial'),
    diagnostico: () => solicitar('/api/diagnostico'),
    despachar: (accion) => solicitar('/api/accion', accion),
    configurarYouTube: (url) => solicitar('/api/youtube', url),
    configurarVolumen: (voz, multimedia) => solicitar('/api/volumen', [voz, multimedia]),
    importarContenido: (categoria) => solicitar('/api/contenido/importar', categoria),
    quitarContenido: (url) => solicitar('/api/contenido/quitar', url),
    abrirCarpetaContenido: (categoria) => solicitar('/api/contenido/abrir', categoria ?? null),
    ajustarVolumenYouTube: async () => 0,
    informarSalud: () => {},
    confirmarAnuncio: () => {},
    alCambiarEstado: (fn) => escuchar('estado', fn),
    alCambiarConfig: (fn) => escuchar('config', fn),
    alCambiarContenido: (fn) => escuchar('contenido', fn),
    alCambiarPantallas: (fn) => escuchar('pantallas', fn),
    alCambiarEntregaAudio: (fn) => escuchar('entregaAudio', fn),
    registrar: () => {},
  };
}
