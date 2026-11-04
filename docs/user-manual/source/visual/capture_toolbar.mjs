// Capture a small control strip at 2x resolution using an isolated Electron profile.
import { app, BrowserWindow } from 'electron';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const output = join(root, 'test-results');
mkdirSync(output, { recursive: true });
process.env.TURNERO_DATOS = mkdtempSync(join(output, 'manual-capture-'));
process.env.TURNERO_PUERTO = '0';
app.commandLine.appendSwitch('force-device-scale-factor', '2');
app.setAppPath(root);
app.setPath('userData', join(process.env.TURNERO_DATOS, 'electron'));
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.showInactive = function () {};
BrowserWindow.prototype.maximize = function () {};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function capture() {
  try {
    await import('../../../../build/main/main.js');
    let operator;
    for (let i = 0; i < 200; i++) {
      operator = BrowserWindow.getAllWindows().find(
        (w) => w.webContents.getURL().includes('/operador/') && !w.webContents.isLoading(),
      );
      if (
        operator &&
        (await operator.webContents.executeJavaScript(
          "Boolean(document.querySelector('.theme-controls'))",
        ))
      )
        break;
      await pause(100);
    }
    if (!operator) throw new Error('No se encontro la ventana del operador.');
    operator.setContentSize(1800, 1200);
    operator.webContents.setBackgroundThrottling(false);
    operator.webContents.setZoomFactor(1);
    await operator.webContents.executeJavaScript('document.fonts.ready');
    await pause(700);
    const rect = await operator.webContents.executeJavaScript(`(() => {
    const r = document.querySelector('.theme-controls').getBoundingClientRect();
    return { x: Math.floor(r.x)-4, y: Math.floor(r.y)-4,
      width: Math.ceil(r.width)+8, height: Math.ceil(r.height)+8 };
  })()`);
    await operator.webContents.capturePage(rect, { stayHidden: true, stayAwake: true });
    await pause(200);
    const image = await operator.webContents.capturePage(rect, {
      stayHidden: true,
      stayAwake: true,
    });
    const bytes = image.toPNG();
    const assets = resolve(root, 'docs/user-manual/source/screenshots/0.4.0');
    writeFileSync(join(assets, 'barra-ajustes.png'), bytes);
    const path = join(assets, 'inventario.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    const record = manifest.imagenes.find((i) => i.archivo === 'barra-ajustes.png');
    const screenshotSize = image.getSize();
    Object.assign(record, {
      procedencia: 'Captura nueva de Electron con datos aislados; sustituye el recurso de octubre.',
      fecha_captura: new Date().toISOString(),
      commit_aplicacion: execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).trim(),
      resolucion_css: [1800, 1200],
      escala_dispositivo: 2,
      zoom: 1,
      recorte_css: rect,
      tamano_px: [screenshotSize.width, screenshotSize.height],
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
    delete record.tamano_original_px;
    delete record.recorte_px;
    writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
    console.log(
      JSON.stringify({ status: 'PASS', image: 'barra-ajustes.png', size: record.tamano_px }),
    );
    app.exit(0);
  } catch (error) {
    console.error(error.message);
    app.exit(1);
  }
}
void capture();
