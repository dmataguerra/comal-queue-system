import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, message, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await check()) return;
    await pause(100);
  }
  throw new Error(message);
}

// Vite activa StrictMode y prueba el origen HTTP; la segunda ejecución usa las vistas compiladas.
async function launch() {
  const { createServer } = await import('vite');
  const { default: electron } = await import('electron');
  const server = await createServer({
    root,
    clearScreen: false,
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  try {
    await server.listen();
    const url = `http://127.0.0.1:${server.httpServer.address().port}`;
    for (const mode of ['development', 'built']) {
      const env = { ...process.env, TURNERO_MEDIA_MODE: mode, TURNERO_DEV_URL: url };
      delete env.ELECTRON_RUN_AS_NODE;
      await new Promise((resolve, reject) => {
        const child = spawn(electron, [fileURLToPath(import.meta.url), '--media-child'], {
          cwd: root,
          env,
          windowsHide: true,
          stdio: 'inherit',
        });
        child.on('error', reject);
        child.on('exit', (code) =>
          code === 0 ? resolve() : reject(new Error(`Multimedia ${mode}: salida ${code}`)),
        );
      });
    }
  } finally {
    await server.close();
  }
}

async function verify() {
  const { app, BrowserWindow } = await import('electron');
  const mode = process.env.TURNERO_MEDIA_MODE;
  if (mode === 'built') delete process.env.TURNERO_DEV_URL;
  const results = join(root, 'test-results');
  mkdirSync(results, { recursive: true });
  const data = mkdtempSync(join(results, 'media-smoke-'));
  const content = join(data, 'contenido');
  for (const directory of ['banner', 'videos', 'voz'])
    mkdirSync(join(content, directory), { recursive: true });
  copyFileSync(join(root, 'public/assets/troyanos-logo.png'), join(content, 'banner/prueba.png'));
  copyFileSync(join(root, 'contenido/aviso.wav'), join(content, 'aviso.wav'));
  writeFileSync(join(data, 'config.json'), JSON.stringify({ youtubeUrl: null, volumenMusica: 0 }));
  process.env.TURNERO_DATOS = data;
  app.setAppPath(root);
  app.setPath('userData', join(data, 'electron'));
  BrowserWindow.prototype.show = function () {};
  BrowserWindow.prototype.showInactive = function () {};
  BrowserWindow.prototype.maximize = function () {};
  const timeout = setTimeout(() => app.exit(1), 60000);
  try {
    await import('../build/main/main.js');
    await waitFor(
      () => BrowserWindow.getAllWindows().filter((w) => !w.webContents.isLoading()).length === 2,
      'No cargaron las dos vistas',
      30000,
    );
    const operator = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes('/operador/'),
    );
    const screen = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes('/publica/'),
    );
    assert.ok(operator && screen);
    for (const window of [operator, screen]) window.webContents.setBackgroundThrottling(false);
    const execute = (window, code) => window.webContents.executeJavaScript(code, true);
    await waitFor(
      () => execute(operator, "Boolean(document.querySelector('nav button'))"),
      'No cargó el operador',
    );
    await execute(
      operator,
      "Array.from(document.querySelectorAll('nav button')).find(b=>b.textContent==='Multimedia').click()",
    );
    const imagesLoaded = (selector) =>
      `(()=>{const images=[...document.querySelectorAll('${selector}')];return images.length===1&&images.every(i=>i.complete&&i.naturalWidth>0)})()`;
    await waitFor(
      () => execute(operator, imagesLoaded('.media-preview img')),
      'Falló la vista previa de imagen',
    );
    await waitFor(
      () => execute(screen, imagesLoaded('.banner-stage img')),
      'Falló la imagen en la TV',
    );
    assert.ok(
      await execute(
        operator,
        `(async()=>{
      const {inventario}=await window.turnero.obtener();
      const response=await fetch(inventario.aviso);
      const context=new OfflineAudioContext(1,1,44100);
      const audio=await context.decodeAudioData(await response.arrayBuffer());
      return audio.duration>0;
    })()`,
      ),
      'Falló la carga y decodificación del audio',
    );

    // Clip sintético: la prueba no depende de los archivos agregados/borrados por el operador.
    const bytes = await execute(
      operator,
      `(async()=>{
      const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
      const context=canvas.getContext('2d');
      const stream=canvas.captureStream(15);const track=stream.getVideoTracks()[0];
      const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
      const chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);
      const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
      for(let i=0;i<30;i++){
        context.fillStyle=i%2?'blue':'orange';context.fillRect(0,0,64,64);
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      recorder.stop();await stopped;track.stop();
      return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
    })()`,
    );
    assert.ok(bytes.length > 1000, `Synthetic video did not encode frames (${bytes.length} bytes)`);
    const fixture = join(data, 'prueba.webm');
    writeFileSync(fixture, Buffer.from(bytes));
    const { importarArchivos } = await import('../build/main/contenido.js');
    assert.equal((await importarArchivos(content, 'videos', [fixture])).agregados.length, 1);
    await waitFor(
      () => execute(operator, "document.querySelector('.media-preview video')?.videoWidth===64"),
      'Falló la vista previa de video',
    );
    await waitFor(
      () =>
        execute(
          screen,
          "(()=>{const v=document.querySelector('.content-video.visible');return Boolean(v?.getAttribute('src')&&v.videoWidth===64&&v.readyState>=2&&!v.paused&&v.currentTime>0.25)})()",
        ),
      'El video de la TV no avanza (comprobar montaje/limpieza de StrictMode)',
    );
    assert.equal(
      await execute(operator, "document.querySelectorAll('.media-file.broken').length"),
      0,
    );
    console.log(
      `PASS multimedia ${mode}: imagen en operador/TV, audio decodificado y video en reproducción.`,
    );
    clearTimeout(timeout);
    app.exit(0);
  } catch (error) {
    console.error(error);
    console.error(
      'Window state:',
      BrowserWindow.getAllWindows().map((window) => ({
        url: window.webContents.getURL(),
        loading: window.webContents.isLoading(),
        crashed: window.webContents.isCrashed(),
      })),
    );
    clearTimeout(timeout);
    app.exit(1);
  }
}

if (process.argv.includes('--media-child')) void verify();
else
  void launch().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
