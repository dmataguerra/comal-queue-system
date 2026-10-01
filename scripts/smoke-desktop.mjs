import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Ejecuta la aplicación real con datos de prueba, sin mostrar ventanas ni tocar la jornada.
const raiz = fileURLToPath(new URL('../', import.meta.url));
const resultados = join(raiz, 'test-results');
mkdirSync(resultados, { recursive: true });
process.env.TURNERO_DATOS = mkdtempSync(join(resultados, 'desktop-'));
cpSync(join(raiz, 'contenido'), join(process.env.TURNERO_DATOS, 'contenido'), { recursive: true });
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
app.setAppPath(raiz);
app.setPath('userData', join(process.env.TURNERO_DATOS, 'electron'));
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.showInactive = function () {};
BrowserWindow.prototype.maximize = function () {};

const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function capturar(ventana, nombre) {
  // Una ventana oculta puede conservar el fotograma anterior hasta la primera captura.
  await ventana.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
  await pausa(300);
  const imagen = await ventana.webContents.capturePage(undefined, {
    stayHidden: true,
    stayAwake: true,
  });
  writeFileSync(join(resultados, nombre), imagen.toPNG());
}
async function esperar(comprobar, mensaje, limite = 15000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limite) {
    if (await comprobar()) return;
    await pausa(100);
  }
  throw new Error(mensaje);
}

async function verificar() {
  try {
    await import('../build/main/main.js');
    await esperar(
      () =>
        BrowserWindow.getAllWindows().filter(
          (w) =>
            /\/vistas\/(operador|publica)\//.test(w.webContents.getURL()) &&
            !w.webContents.isLoading(),
        ).length === 2,
      'No se crearon las dos vistas',
    );
    const operador = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes('/operador/'),
    );
    const publica = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes('/publica/'),
    );
    assert.ok(operador && publica);
    const urlPublica = publica.webContents.getURL();
    await publica.webContents.executeJavaScript("location.href = 'https://example.org/'");
    await pausa(300);
    assert.equal(
      publica.webContents.getURL(),
      urlPublica,
      'La vista pública no debe navegar fuera de la app',
    );
    operador.webContents.setBackgroundThrottling(false);
    const ejecutar = (ventana, expresion) => ventana.webContents.executeJavaScript(expresion, true);
    await esperar(
      () => ejecutar(operador, "Boolean(document.querySelector('#turn-number'))"),
      'No cargó el operador',
    );
    await esperar(
      () => ejecutar(publica, "Boolean(document.querySelector('.public-screen'))"),
      'No cargó la pantalla pública',
    );
    await ejecutar(
      operador,
      `Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent==='Ayuda').click()`,
    );
    await ejecutar(operador, `document.querySelector('.help-diagnostics-link').click()`);
    await esperar(
      () => ejecutar(operador, "Boolean(document.querySelector('.diagnostics-grid'))"),
      'No cargó el diagnóstico del operador',
    );
    assert.equal(
      await ejecutar(publica, "Boolean(document.querySelector('.diagnostics-grid'))"),
      false,
      'La TV no debe mostrar diagnósticos',
    );
    assert.equal(
      await ejecutar(
        publica,
        "Boolean(document.querySelector('.audio-warning, .display-notices'))",
      ),
      false,
      'La TV no debe mostrar errores técnicos',
    );
    await ejecutar(
      operador,
      `Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent==='Turnos').click()`,
    );
    // Comprobar animación real y la preferencia de accesibilidad en el renderizador.
    // Hosted Windows runners can default to reduced motion; control both test states.
    publica.webContents.debugger.attach('1.3');
    await publica.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
    });
    const animacionActiva = () =>
      ejecutar(publica, "Boolean(document.querySelector('.public-animated-background animate'))");
    await esperar(animacionActiva, 'El fondo no se anima', 3000);
    await publica.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    publica.reload();
    await esperar(
      () => ejecutar(publica, "Boolean(document.querySelector('.public-screen'))"),
      'La pantalla pública no recargó para la prueba de movimiento reducido',
    );
    assert.equal(
      await ejecutar(
        publica,
        "Boolean(document.querySelector('.public-animated-background animate'))",
      ),
      false,
      'El fondo debe respetar prefers-reduced-motion',
    );
    await publica.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
    });
    operador.setSize(1280, 900);
    publica.setSize(1280, 900);
    const inventario = await ejecutar(operador, 'window.turnero.obtener()');
    assert.equal(
      inventario.inventario.voz.filter(Boolean).length,
      100,
      'Faltan voces en el inventario',
    );
    assert.match(inventario.inventario.voz[40], /\/voz\/40\.wav$/, 'El turno 40 debe usar WAV');
    assert.ok(inventario.inventario.aviso, 'Falta el aviso');
    assert.ok(inventario.inventario.banner.length >= 2, 'Faltan las imágenes locales');
    await esperar(
      () =>
        ejecutar(
          publica,
          `(()=>{const images=[...document.querySelectorAll('.banner-stage img')].filter(i=>i.src.includes('/contenido/banner/'));return images.length===${inventario.inventario.banner.length}&&images.every(i=>i.complete&&i.naturalWidth>0)})()`,
        ),
      'Las imágenes locales no se mostraron',
    );
    assert.equal(
      await ejecutar(
        publica,
        `fetch(${JSON.stringify(inventario.inventario.aviso)}).then((r) => r.headers.get('access-control-allow-origin'))`,
      ),
      null,
      'El contenido local no debe permitir CORS comodín',
    );
    const audioDecodificado = await ejecutar(
      publica,
      `(async () => {
      const { inventario } = await window.turnero.obtener();
      const contexto = new AudioContext();
      const errores = [];
      for (const url of [inventario.aviso, ...inventario.voz]) {
        try {
          if (!url) throw new Error('Sin archivo');
          const respuesta = await fetch(url);
          if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);
          const audio = await contexto.decodeAudioData(await respuesta.arrayBuffer());
          if (audio.duration < 0.3) throw new Error('Duración inválida');
          let pico = 0;
          for (let canal = 0; canal < audio.numberOfChannels; canal++) {
            const muestras = audio.getChannelData(canal);
            for (let i = 0; i < muestras.length; i++) pico = Math.max(pico, Math.abs(muestras[i]));
          }
          if (pico < 0.01) throw new Error('Audio silencioso');
        } catch (error) { errores.push(url + ': ' + error.message); }
      }
      await contexto.close();
      return { archivos: 101, errores };
    })()`,
    );
    assert.deepEqual(
      audioDecodificado.errores,
      [],
      'Hay archivos de audio que Chromium no reproduce',
    );
    await esperar(
      () => ejecutar(operador, "window.turnero.diagnostico().then(d=>d.audio==='correcto')"),
      'Diagnósticos sigue marcando el audio como degradado',
    );
    if (process.env.TURNERO_SMOKE_QUICK === '1') {
      console.log('PASS: imágenes locales, audio y diagnóstico en modo desarrollo.');
      app.exit(0);
      return;
    }
    console.log(
      `PASS: ${audioDecodificado.archivos} audios seleccionados se decodifican en Chromium.`,
    );
    assert.ok(
      inventario.inventario.voz[55] && inventario.inventario.voz[66],
      'Faltan voces de prueba',
    );
    await ejecutar(
      publica,
      `window.anunciosPrueba=[]; new MutationObserver(()=>{const n=document.querySelector('.announcement-number')?.textContent;if(n&&window.anunciosPrueba.at(-1)?.n!==n)window.anunciosPrueba.push({n,t:Date.now()});}).observe(document.body,{subtree:true,childList:true,characterData:true});`,
    );
    await ejecutar(
      operador,
      `window.turnero.despachar({tipo:'LLAMAR',entrada:'55'}).then(()=>window.turnero.despachar({tipo:'LLAMAR',entrada:'66'}))`,
    );
    await esperar(
      () => ejecutar(publica, 'window.anunciosPrueba.length===2'),
      'Los anuncios no avanzaron en orden',
      20000,
    );
    const anuncios = await ejecutar(publica, 'window.anunciosPrueba');
    assert.deepEqual(
      anuncios.map((a) => a.n),
      ['55', '66'],
    );
    assert.ok(
      anuncios[1].t - anuncios[0].t >= 5900,
      'El anuncio debe permanecer visible al menos seis segundos',
    );
    const anuncioEnMultimedia = await ejecutar(
      publica,
      `(()=>{const a=document.querySelector('.public-focus'),m=document.querySelector('.public-media-frame');if(!a||!m)return null;const x=a.getBoundingClientRect(),y=m.getBoundingClientRect();return {dentro:a.parentElement===m,centroX:Math.abs((x.left+x.right-y.left-y.right)/2),centroY:Math.abs((x.top+x.bottom-y.top-y.bottom)/2)};})()`,
    );
    assert.ok(anuncioEnMultimedia?.dentro, 'El anuncio no está dentro del reproductor multimedia');
    assert.ok(
      anuncioEnMultimedia.centroX <= 1 && anuncioEnMultimedia.centroY <= 1,
      'El anuncio no está centrado en el reproductor multimedia',
    );
    assert.equal(
      await ejecutar(publica, "document.querySelector('.audio-warning')?.textContent ?? ''"),
      '',
      'La pantalla reportó un error de audio al precargar los MP3 válidos',
    );
    await pausa(800);
    await capturar(publica, 'anuncio-multimedia.png');
    assert.equal(await ejecutar(publica, "document.querySelectorAll('.trojan-mascot').length"), 0);

    for (const [ancho, alto] of [
      [1280, 900],
      [900, 650],
    ]) {
      operador.setSize(ancho, alto);
      await pausa(200);
      const geometria = await ejecutar(
        operador,
        `(()=>{const row=document.querySelector('[aria-label="Acciones del turno 66"]');return {buttons:row.querySelectorAll('button').length,visible:[...row.querySelectorAll('button')].every(b=>b.getBoundingClientRect().right<=innerWidth)};})()`,
      );
      assert.deepEqual(geometria, { buttons: 2, visible: true });
      await capturar(operador, `operador-${ancho}.png`);
    }
    await ejecutar(
      operador,
      `window.turnero.despachar({tipo:'QUITAR',n:66}).then(()=>window.turnero.despachar({tipo:'DESHACER'}))`,
    );
    const estado = await ejecutar(operador, 'window.turnero.obtener()');
    assert.equal(estado.instantanea.actual, 55);
    assert.equal(estado.instantanea.puedeDeshacer, false);
    await ejecutar(
      operador,
      `Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent==='Multimedia').click()`,
    );
    await pausa(200);
    await capturar(operador, 'multimedia.png');
    await ejecutar(
      operador,
      `window.turnero.configurarYouTube('https://www.youtube.com/watch?v=M7lc1UVf-VE')`,
    );
    await esperar(
      () => ejecutar(publica, "Boolean(document.querySelector('.youtube-host iframe'))"),
      'No se creó el reproductor YouTube',
      25000,
    );
    await pausa(5000);
    await capturar(publica, 'youtube.png');
    await ejecutar(operador, `window.turnero.despachar({tipo:'LLAMAR',entrada:'77'})`);
    await esperar(
      () =>
        ejecutar(
          publica,
          "document.querySelector('.public-media-frame .announcement-number')?.textContent==='77'",
        ),
      'El anuncio no apareció sobre YouTube',
    );
    await pausa(800);
    await capturar(publica, 'youtube-anuncio.png');

    await ejecutar(operador, 'window.turnero.configurarYouTube(null)');
    await publica.webContents.debugger.sendCommand('Network.enable');
    await publica.webContents.debugger.sendCommand('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    await ejecutar(operador, `window.turnero.despachar({tipo:'LLAMAR',entrada:'88'})`);
    await esperar(
      () => ejecutar(publica, "document.querySelector('.announcement-number')?.textContent==='88'"),
      'El llamado local no funcionó sin internet',
    );
    assert.equal(
      await ejecutar(
        publica,
        `fetch(${JSON.stringify(inventario.inventario.aviso)}).then(r=>r.ok)`,
      ),
      true,
      'El aviso local no se pudo leer sin internet',
    );
    await publica.webContents.debugger.sendCommand('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    console.log('PASS: llamada y aviso local con la red emulada sin conexión.');
    for (const n of [11, 22, 33, 44]) {
      await ejecutar(operador, `window.turnero.despachar({tipo:'LLAMAR',entrada:'${n}'})`);
    }
    await esperar(
      () => ejecutar(publica, "!document.querySelector('.announcement-number')"),
      'No terminó la cola',
      90000,
    );
    const medir = () =>
      ejecutar(
        publica,
        `(() => {
      const rect = (s) => { const r=document.querySelector(s).getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; };
      const frame=rect('.public-media-frame'), queue=rect('.public-queue');
      const clipped=[...document.querySelectorAll('.public-turn > *, .announcement-card > *')].some(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect(); return r.top<p.top-1||r.bottom>p.bottom+1||r.left<p.left-1||r.right>p.right+1;});
      return {frame, aligned: Math.abs(frame.y-queue.y)<1 && Math.abs(frame.height-queue.height)<1, clipped, rows:document.querySelectorAll('.public-turn').length, overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight};
    })()`,
      );
    for (const [width, height] of [
      [1920, 1080],
      [2560, 1440],
      [3840, 2160],
    ]) {
      publica.webContents.enableDeviceEmulation({
        screenPosition: 'desktop',
        screenSize: { width, height },
        viewPosition: { x: 0, y: 0 },
        viewSize: { width, height },
        deviceScaleFactor: 1,
        scale: Math.min(1, 1920 / width, 1080 / height),
      });
      await pausa(500);
      assert.deepEqual(await ejecutar(publica, '[innerWidth, innerHeight]'), [width, height]);
      await esperar(
        () =>
          ejecutar(
            publica,
            "(()=>{const r=document.querySelector('.public-screen').getBoundingClientRect(),s=Math.min(innerWidth/1920,innerHeight/1080);return Math.abs(r.width-1920*s)<1&&Math.abs(r.height-1080*s)<1})()",
          ),
        'El lienzo público no estabilizó su escala',
      );
      const normal = await medir();
      assert.equal(normal.rows, 6);
      assert.ok(normal.aligned && !normal.clipped && !normal.overflow, JSON.stringify(normal));
      await capturar(publica, `publica-normal-${width}.png`);
      const ticker = () =>
        ejecutar(
          publica,
          "getComputedStyle(document.querySelector('.footer-ticker-track')).transform",
        );
      const antes = await ticker();
      await pausa(150);
      assert.notEqual(await ticker(), antes);
      await ejecutar(operador, "window.turnero.despachar({tipo:'LLAMAR',entrada:'44'})");
      await esperar(
        () => ejecutar(publica, "Boolean(document.querySelector('.announcement-number'))"),
        'No apareció el anuncio',
      );
      await pausa(600);
      const activo = await medir();
      assert.deepEqual(activo.frame, normal.frame, 'El marco multimedia cambió de tamaño');
      assert.ok(!activo.clipped && !activo.overflow, JSON.stringify(activo));
      await capturar(publica, `publica-anuncio-${width}.png`);
      await esperar(
        () => ejecutar(publica, "!document.querySelector('.public-focus.is-visible')"),
        'No empezó la salida',
      );
      await esperar(
        () => ejecutar(publica, "!document.querySelector('.announcement-number')"),
        'No terminó la salida',
      );
      assert.deepEqual((await medir()).frame, normal.frame);
    }
    console.log(
      'PASS: seis pedidos, ticker en movimiento, anuncio y salida sin cambios de geometría ni recortes en 1080p, 1440p y 4K.',
    );
    console.log(
      'PASS: anuncios 55→66, acciones directas en dos tamaños, eliminación sin restauración y anuncio centrado sobre multimedia/YouTube.',
    );
    console.log(
      'YouTube:',
      await ejecutar(
        publica,
        "document.querySelector('.youtube-error')?.textContent ?? 'Sin error reportado por el reproductor'",
      ),
    );
    publica.webContents.debugger.detach();
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
}
void verificar();
