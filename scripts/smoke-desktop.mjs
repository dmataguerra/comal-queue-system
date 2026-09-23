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
    operador.setSize(1280, 900);
    publica.setSize(1280, 900);
    const inventario = await ejecutar(operador, 'window.turnero.obtener()');
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
    assert.ok(anuncios[1].t - anuncios[0].t >= 3900, 'El segundo anuncio interrumpió el primero');
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
      await ejecutar(
        operador,
        `document.querySelector('[aria-label="Acciones del turno 66"]').click()`,
      );
      await pausa(1200);
      const geometria = await ejecutar(
        operador,
        `(()=>{const b=document.querySelector('[aria-label="Acciones del turno 66"]').getBoundingClientRect(),m=document.querySelector('.turn-menu-popup').getBoundingClientRect();return {abajo:m.top>=b.bottom,visible:m.bottom<=innerHeight};})()`,
      );
      assert.deepEqual(geometria, { abajo: true, visible: true });
      await capturar(operador, `operador-${ancho}.png`);
      await ejecutar(operador, 'document.body.click()');
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
    console.log(
      'PASS: anuncios 55→66, menú en dos tamaños, eliminación sin restauración y anuncio centrado sobre multimedia/YouTube.',
    );
    console.log(
      'YouTube:',
      await ejecutar(
        publica,
        "document.querySelector('.youtube-error')?.textContent ?? 'Sin error reportado por el reproductor'",
      ),
    );
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
}
void verificar();
