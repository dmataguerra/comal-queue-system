/**
 * RF-11 · el IFrame API habla por postMessage y YouTube no acepta el origen turnero://, así que
 * setVolume se pierde. Desde main se entra al iframe y se mueve el volumen del <video> con la misma
 * rampa que los videos locales. No toca muted ni paused: la pausa o el mute del usuario se respetan.
 */
export const scriptVolumen = (volumen: number, rampa: number) => `(async () => {
  const destino = ${JSON.stringify(volumen)}, ms = ${JSON.stringify(rampa)};
  const id = (window.__turneroRampa = (window.__turneroRampa || 0) + 1);
  const limite = performance.now() + 6000;
  let videos = [];
  // El iframe puede existir antes que su elemento <video>. No confirmamos el
  // ducking hasta que el reproductor real esté presente y la rampa termine.
  while (!(videos = [...document.querySelectorAll('video')]).length && performance.now() < limite) {
    if (window.__turneroRampa !== id) return { videos: 0, sonando: 0 };
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  if (!videos.length || window.__turneroRampa !== id) return { videos: 0, sonando: 0 };
  await Promise.all(videos.map(video => new Promise((resolve, reject) => {
    const desde = video.volume, inicio = performance.now();
    const paso = (ahora) => {
      if (window.__turneroRampa !== id || video.isConnected === false) { reject(new Error('Rampa reemplazada o video desconectado')); return; }
      const t = ms ? Math.min(1, (ahora - inicio) / ms) : 1;
      video.volume = desde + (destino - desde) * t;
      if (t < 1) setTimeout(() => paso(performance.now()), 16);
      else { video.volume = destino; resolve(); }
    };
    paso(inicio);
  })));
  if (window.__turneroRampa !== id || videos.some(v => v.isConnected === false || Math.abs(v.volume - destino) > 0.001)) return { videos: 0, sonando: 0 };
  return {
    videos: videos.length,
    sonando: videos.filter((v) => !v.paused && !v.muted && v.volume > 0).length,
  };
})()`;
