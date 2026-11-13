import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const resultsDir = join(root, 'test-results');
mkdirSync(resultsDir, { recursive: true });
process.env.TURNERO_DATOS = mkdtempSync(join(resultsDir, 'desktop-'));
cpSync(join(root, 'contenido'), join(process.env.TURNERO_DATOS, 'contenido'), { recursive: true });
app.commandLine.appendSwitch('disable-gpu');
app.disableHardwareAcceleration();
app.setAppPath(root);
app.setPath('userData', join(process.env.TURNERO_DATOS, 'electron'));
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.showInactive = function () {};
BrowserWindow.prototype.maximize = function () {};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function capture(appWindow, name) {
  await appWindow.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
  await pause(300);
  const image = await appWindow.webContents.capturePage(undefined, {
    stayHidden: true,
    stayAwake: true,
  });
  writeFileSync(join(resultsDir, name), image.toPNG());
}
async function waitFor(check, message, timeout = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (await check()) return;
    await pause(100);
  }
  throw new Error(message);
}
async function verify() {
  try {
    await import('../build/main/main.js');
    await waitFor(
      () =>
        BrowserWindow.getAllWindows().filter(
          (w) =>
            /\/views\/(operator|display)\//.test(w.webContents.getURL()) &&
            !w.webContents.isLoading(),
        ).length === 2,
      'No se crearon las dos vistas',
    );
    const operatorWindow = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes('/operator/'),
    );
    const displayWindow = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes('/display/'),
    );
    assert.ok(operatorWindow && displayWindow);
    const displayUrl = displayWindow.webContents.getURL();
    await displayWindow.webContents.executeJavaScript("location.href = 'https://example.org/'");
    await pause(300);
    assert.equal(
      displayWindow.webContents.getURL(),
      displayUrl,
      'La vista pública no debe navegar fuera de la app',
    );
    operatorWindow.webContents.setBackgroundThrottling(false);
    const run = (appWindow, expression) =>
      appWindow.webContents.executeJavaScript(expression, true);
    await waitFor(
      () => run(operatorWindow, "Boolean(document.querySelector('#turn-number'))"),
      'No cargó el operador',
    );
    await waitFor(
      () => run(displayWindow, "Boolean(document.querySelector('.public-screen'))"),
      'No cargó la pantalla pública',
    );
    await run(operatorWindow, `document.querySelector('.help-button').click()`);
    await run(operatorWindow, `document.querySelector('.help-diagnostics-link').click()`);
    await waitFor(
      () => run(operatorWindow, "Boolean(document.querySelector('.diagnostics-grid'))"),
      'No cargó el diagnóstico del operador',
    );
    assert.equal(
      await run(displayWindow, "Boolean(document.querySelector('.diagnostics-grid'))"),
      false,
      'La TV no debe mostrar diagnósticos',
    );
    assert.equal(
      await run(
        displayWindow,
        "Boolean(document.querySelector('.audio-warning, .display-notices'))",
      ),
      false,
      'La TV no debe mostrar errores técnicos',
    );
    await run(
      operatorWindow,
      `Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent==='Turnos').click()`,
    );
    displayWindow.webContents.debugger.attach('1.3');
    await displayWindow.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
    });
    const isBackgroundAnimated = () =>
      run(displayWindow, "Boolean(document.querySelector('.public-animated-background animate'))");
    await waitFor(isBackgroundAnimated, 'El fondo no se anima', 3000);
    await displayWindow.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    displayWindow.reload();
    await waitFor(
      () => run(displayWindow, "Boolean(document.querySelector('.public-screen'))"),
      'La pantalla pública no recargó para la prueba de movimiento reducido',
    );
    assert.equal(
      await run(
        displayWindow,
        "Boolean(document.querySelector('.public-animated-background animate'))",
      ),
      false,
      'El fondo debe respetar prefers-reduced-motion',
    );
    await displayWindow.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
    });
    operatorWindow.setSize(1280, 900);
    displayWindow.setSize(1280, 900);
    const inventory = await run(operatorWindow, 'window.turnero.obtener()');
    assert.equal(
      inventory.inventario.voz.filter(Boolean).length,
      100,
      'Faltan voces en el inventario',
    );
    assert.match(inventory.inventario.voz[40], /\/voz\/40\.wav$/, 'El turno 40 debe usar WAV');
    assert.ok(inventory.inventario.aviso, 'Falta el aviso');
    assert.ok(inventory.inventario.banner.length >= 2, 'Faltan las imágenes locales');
    await waitFor(
      () =>
        run(
          displayWindow,
          `(()=>{const images=[...document.querySelectorAll('.banner-stage img')].filter(i=>i.src.includes('/contenido/banner/'));return images.length===${inventory.inventario.banner.length}&&images.every(i=>i.complete&&i.naturalWidth>0)})()`,
        ),
      'Las imágenes locales no se mostraron',
    );
    assert.equal(
      await run(
        displayWindow,
        `fetch(${JSON.stringify(inventory.inventario.aviso)}).then((r) => r.headers.get('access-control-allow-origin'))`,
      ),
      null,
      'El contenido local no debe permitir CORS comodín',
    );
    const decodedAudio = await run(
      displayWindow,
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
    assert.deepEqual(decodedAudio.errores, [], 'Hay archivos de audio que Chromium no reproduce');
    await waitFor(
      () => run(operatorWindow, "window.turnero.diagnostico().then(d=>d.audio==='correcto')"),
      'Diagnósticos sigue marcando el audio como degradado',
    );
    if (process.env.TURNERO_SMOKE_QUICK === '1') {
      console.log('PASS: imágenes locales, audio y diagnóstico en modo desarrollo.');
      app.exit(0);
      return;
    }
    console.log(`PASS: ${decodedAudio.archivos} audios seleccionados se decodifican en Chromium.`);
    assert.ok(
      inventory.inventario.voz[55] && inventory.inventario.voz[66],
      'Faltan voces de prueba',
    );
    await run(
      displayWindow,
      `window.anunciosPrueba=[]; new MutationObserver(()=>{const n=document.querySelector('.announcement-number')?.textContent;if(n&&window.anunciosPrueba.at(-1)?.n!==n)window.anunciosPrueba.push({n,t:Date.now()});}).observe(document.body,{subtree:true,childList:true,characterData:true});`,
    );
    await run(
      operatorWindow,
      `window.turnero.despachar({tipo:'LLAMAR',entrada:'55'}).then(()=>window.turnero.despachar({tipo:'LLAMAR',entrada:'66'}))`,
    );
    await waitFor(
      () => run(displayWindow, 'window.anunciosPrueba.length===2'),
      'Los anuncios no avanzaron en orden',
      20000,
    );
    const announcements = await run(displayWindow, 'window.anunciosPrueba');
    assert.deepEqual(
      announcements.map((a) => a.n),
      ['55', '66'],
    );
    assert.ok(
      announcements[1].t - announcements[0].t >= 5900,
      'El anuncio debe permanecer visible al menos seis segundos',
    );
    const announcementInMedia = await run(
      displayWindow,
      `(()=>{const a=document.querySelector('.public-focus'),m=document.querySelector('.public-media-frame');if(!a||!m)return null;const x=a.getBoundingClientRect(),y=m.getBoundingClientRect();return {dentro:a.parentElement===m,centroX:Math.abs((x.left+x.right-y.left-y.right)/2),centroY:Math.abs((x.top+x.bottom-y.top-y.bottom)/2)};})()`,
    );
    assert.ok(announcementInMedia?.dentro, 'El anuncio no está dentro del reproductor multimedia');
    assert.ok(
      announcementInMedia.centroX <= 1 && announcementInMedia.centroY <= 1,
      'El anuncio no está centrado en el reproductor multimedia',
    );
    assert.equal(
      await run(displayWindow, "document.querySelector('.audio-warning')?.textContent ?? ''"),
      '',
      'La pantalla reportó un error de audio al precargar los WAV válidos',
    );
    await pause(800);
    await capture(displayWindow, 'anuncio-multimedia.png');
    assert.equal(await run(displayWindow, "document.querySelectorAll('.trojan-mascot').length"), 0);
    for (const [viewWidth, viewHeight] of [
      [1280, 900],
      [900, 650],
    ]) {
      operatorWindow.setSize(viewWidth, viewHeight);
      await pause(200);
      const geometry = await run(
        operatorWindow,
        `(()=>{const row=document.querySelector('[aria-label="Acciones del turno 66"]');return {buttons:row.querySelectorAll('button').length,visible:[...row.querySelectorAll('button')].every(b=>b.getBoundingClientRect().right<=innerWidth)};})()`,
      );
      assert.deepEqual(geometry, { buttons: 2, visible: true });
      await capture(operatorWindow, `operador-${viewWidth}.png`);
    }
    await run(
      operatorWindow,
      `window.turnero.despachar({tipo:'QUITAR',n:66}).then(()=>window.turnero.despachar({tipo:'DESHACER'}))`,
    );
    const state = await run(operatorWindow, 'window.turnero.obtener()');
    assert.equal(state.instantanea.actual, 55);
    assert.equal(state.instantanea.puedeDeshacer, false);
    await run(
      operatorWindow,
      `Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent==='Multimedia').click()`,
    );
    await pause(200);
    await capture(operatorWindow, 'multimedia.png');
    await run(
      operatorWindow,
      `window.turnero.configurarYouTube('https://www.youtube.com/watch?v=M7lc1UVf-VE')`,
    );
    await waitFor(
      () => run(displayWindow, "Boolean(document.querySelector('.youtube-host iframe'))"),
      'No se creó el reproductor YouTube',
      25000,
    );
    await pause(5000);
    await capture(displayWindow, 'youtube.png');
    await run(operatorWindow, `window.turnero.despachar({tipo:'LLAMAR',entrada:'77'})`);
    await waitFor(
      () =>
        run(
          displayWindow,
          "document.querySelector('.public-media-frame .announcement-number')?.textContent==='77'",
        ),
      'El anuncio no apareció sobre YouTube',
    );
    await pause(800);
    await capture(displayWindow, 'youtube-anuncio.png');
    await run(operatorWindow, 'window.turnero.configurarYouTube(null)');
    await displayWindow.webContents.debugger.sendCommand('Network.enable');
    await displayWindow.webContents.debugger.sendCommand('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    await run(operatorWindow, `window.turnero.despachar({tipo:'LLAMAR',entrada:'88'})`);
    await waitFor(
      () =>
        run(displayWindow, "document.querySelector('.announcement-number')?.textContent==='88'"),
      'El llamado local no funcionó sin internet',
    );
    assert.equal(
      await run(
        displayWindow,
        `fetch(${JSON.stringify(inventory.inventario.aviso)}).then(r=>r.ok)`,
      ),
      true,
      'El aviso local no se pudo leer sin internet',
    );
    await displayWindow.webContents.debugger.sendCommand('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    console.log('PASS: llamada y aviso local con la red emulada sin conexión.');
    for (const n of [11, 22, 33, 44]) {
      await run(operatorWindow, `window.turnero.despachar({tipo:'LLAMAR',entrada:'${n}'})`);
    }
    await waitFor(
      () => run(displayWindow, "!document.querySelector('.announcement-number')"),
      'No terminó la cola',
      90000,
    );
    const measure = () =>
      run(
        displayWindow,
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
      displayWindow.webContents.enableDeviceEmulation({
        screenPosition: 'desktop',
        screenSize: { width, height },
        viewPosition: { x: 0, y: 0 },
        viewSize: { width, height },
        deviceScaleFactor: 1,
        scale: Math.min(1, 1920 / width, 1080 / height),
      });
      await pause(500);
      assert.deepEqual(await run(displayWindow, '[innerWidth, innerHeight]'), [width, height]);
      await waitFor(
        () =>
          run(
            displayWindow,
            "(()=>{const r=document.querySelector('.public-screen').getBoundingClientRect(),s=Math.min(innerWidth/1920,innerHeight/1080);return Math.abs(r.width-1920*s)<1&&Math.abs(r.height-1080*s)<1})()",
          ),
        'El lienzo público no estabilizó su escala',
      );
      const normal = await measure();
      assert.equal(normal.rows, 6);
      assert.ok(normal.aligned && !normal.clipped && !normal.overflow, JSON.stringify(normal));
      await capture(displayWindow, `publica-normal-${width}.png`);
      const ticker = () =>
        run(
          displayWindow,
          "getComputedStyle(document.querySelector('.footer-ticker-track')).transform",
        );
      const before = await ticker();
      await pause(150);
      assert.notEqual(await ticker(), before);
      await run(operatorWindow, "window.turnero.despachar({tipo:'LLAMAR',entrada:'44'})");
      await waitFor(
        () => run(displayWindow, "Boolean(document.querySelector('.announcement-number'))"),
        'No apareció el anuncio',
      );
      await pause(600);
      const activo = await measure();
      assert.deepEqual(activo.frame, normal.frame, 'El marco multimedia cambió de tamaño');
      assert.ok(!activo.clipped && !activo.overflow, JSON.stringify(activo));
      await capture(displayWindow, `publica-anuncio-${width}.png`);
      await waitFor(
        () => run(displayWindow, "!document.querySelector('.public-focus.is-visible')"),
        'No empezó la salida',
      );
      await waitFor(
        () => run(displayWindow, "!document.querySelector('.announcement-number')"),
        'No terminó la salida',
      );
      assert.deepEqual((await measure()).frame, normal.frame);
    }
    console.log(
      'PASS: seis pedidos, ticker en movimiento, anuncio y salida sin cambios de geometría ni recortes en 1080p, 1440p y 4K.',
    );
    console.log(
      'PASS: anuncios 55→66, acciones directas en dos tamaños, eliminación sin restauración y anuncio centrado sobre multimedia/YouTube.',
    );
    console.log(
      'YouTube:',
      await run(
        displayWindow,
        "document.querySelector('.youtube-error')?.textContent ?? 'Sin error reportado por el reproductor'",
      ),
    );
    displayWindow.webContents.debugger.detach();
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
}
void verify();
