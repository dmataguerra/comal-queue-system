import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'test-results');
mkdirSync(output, { recursive: true });
process.env.TURNERO_DATOS = mkdtempSync(join(output, 'display-scale-'));
app.setAppPath(root);
app.setPath('userData', join(process.env.TURNERO_DATOS, 'electron'));
BrowserWindow.prototype.show = function () {};
BrowserWindow.prototype.showInactive = function () {};
BrowserWindow.prototype.maximize = function () {};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function verify() {
  try {
    await import('../build/main/main.js');
    let client;
    for (let i = 0; i < 150; i++) {
      client = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes('/publica/'),
      );
      if (
        client &&
        !client.webContents.isLoading() &&
        (await client.webContents.executeJavaScript(
          "Boolean(document.querySelector('.public-screen'))",
        ))
      )
        break;
      await pause(100);
    }
    assert.ok(client, 'Public display opened');
    client.setFullScreen(false);
    client.webContents.setBackgroundThrottling(false);
    let baseline;
    for (const [width, height, zoom] of [
      [1920, 1080, 1],
      [3840, 2160, 1],
      [1280, 720, 1],
      [1920, 1080, 1.5],
      [1024, 768, 1],
      [640, 360, 1],
    ]) {
      client.setContentSize(width, height);
      client.webContents.setZoomFactor(zoom);
      const expectedViewport = [width / zoom, height / zoom];
      let metrics;
      for (let intento = 0; intento < 60; intento++) {
        metrics = await client.webContents.executeJavaScript(`(() => {
          const viewport = [innerWidth, innerHeight];
          const expectedViewport = ${JSON.stringify(expectedViewport)};
          if (
            Math.abs(viewport[0] - expectedViewport[0]) >= 0.5 ||
            Math.abs(viewport[1] - expectedViewport[1]) >= 0.5
          )
            return { ready: false, reason: 'viewport', viewport, expectedViewport };
          const canvas = document.querySelector('.public-screen');
          if (!canvas) return { ready: false, reason: 'canvas', viewport, expectedViewport };
          const bounds = canvas.getBoundingClientRect();
          const scale = Math.min(viewport[0] / 1920, viewport[1] / 1080);
          const elements = [
            '.public-queue',
            '.public-media-frame',
            '.public-footer',
            '.public-title-row h1',
            '.footer-ticker-item',
            '.footer-logo-plate',
          ].map((selector) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return [rect.width / scale, rect.height / scale, getComputedStyle(element).fontSize];
          });
          return {
            ready:
              Math.abs(bounds.width - 1920 * scale) < 2 &&
              Math.abs(bounds.height - 1080 * scale) < 2 &&
              Math.abs(bounds.x - (viewport[0] - bounds.width) / 2) < 1 &&
              Math.abs(bounds.y - (viewport[1] - bounds.height) / 2) < 1 &&
              !elements.some((element) => element === null),
            scale,
            width: bounds.width,
            height: bounds.height,
            x: bounds.x,
            y: bounds.y,
            viewport,
            elements,
          };
        })()`);
        if (metrics?.ready) break;
        await pause(50);
      }
      assert.ok(
        metrics?.ready,
        `Canvas did not stabilize at ${width}x${height}, zoom ${zoom}: ${JSON.stringify(metrics)}`,
      );
      assert.ok(Math.abs(metrics.width - 1920 * metrics.scale) < 2, JSON.stringify(metrics));
      assert.ok(Math.abs(metrics.height - 1080 * metrics.scale) < 2);
      assert.ok(Math.abs(metrics.x - (metrics.viewport[0] - metrics.width) / 2) < 1);
      assert.ok(Math.abs(metrics.y - (metrics.viewport[1] - metrics.height) / 2) < 1);
      if (!baseline) baseline = metrics.elements;
      metrics.elements.forEach((row, i) => {
        if (zoom !== 1 && i === 4) return;
        assert.ok(Math.abs(row[0] - baseline[i][0]) < 1, 'Proportional width');
        assert.ok(Math.abs(row[1] - baseline[i][1]) < 1, 'Proportional height');
        assert.equal(row[2], baseline[i][2], 'Stable design typography');
      });
      if (zoom === 1 && width >= 1920) {
        const image = await client.webContents.capturePage(undefined, {
          stayHidden: true,
          stayAwake: true,
        });
        writeFileSync(join(output, `display-${width}.png`), image.toPNG());
      }
      console.log(`PASS ${width}x${height}, zoom ${zoom}`);
    }
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
}
void verify();
