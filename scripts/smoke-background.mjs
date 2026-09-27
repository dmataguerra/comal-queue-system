import { app, BrowserWindow } from 'electron';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
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
    client.setContentSize(1920, 1080);
    await pause(500);
    const run = (code) => client.webContents.executeJavaScript(code);
    const capture = async (name) => {
      await pause(100);
      const image = await client.webContents.capturePage(undefined, {
        stayHidden: true,
        stayAwake: true,
      });
      writeFileSync(join(output, `${name}.png`), image.toPNG());
      return image.toDataURL();
    };
    await client.webContents.debugger.attach('1.3');
    await client.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await pause(200);
    assert.equal(
      await run("document.querySelectorAll('.public-animated-background animate').length"),
      0,
    );
    await capture('waves-full-blue');
    await run(
      `(() => { const style=document.createElement('style'); style.id='background-only'; style.textContent='.public-screen > :not(.public-animated-background) { opacity:0 !important }'; document.head.append(style); })()`,
    );
    const actual = await capture('waves-base');
    const reference =
      'data:image/png;base64,' +
      readFileSync(join(root, 'public/assets/reference/public-background.png')).toString('base64');
    const comparison = await run(`(async () => {
      const load = src => new Promise(resolve => { const im=new Image(); im.onload=()=>resolve(im); im.src=src; });
      const a=await load(${JSON.stringify(actual)}), b=await load(${JSON.stringify(reference)});
      const c=document.createElement('canvas'); c.width=1920; c.height=1080; const x=c.getContext('2d');
      x.drawImage(b,0,0,1920,1080); const ref=x.getImageData(0,0,1920,1080).data;
      x.clearRect(0,0,1920,1080); x.drawImage(a,0,0,1920,1080); const out=x.getImageData(0,0,1920,1080).data;
      let error=0, mismatch=0; for(let i=0;i<ref.length;i+=4) { for(let j=0;j<3;j++) error+=Math.abs(ref[i+j]-out[i+j]); if((ref[i]<200)!==(out[i]<200)) mismatch++; }
      x.drawImage(b,0,0,1920,1080); x.globalAlpha=.5; x.drawImage(a,0,0,1920,1080);
      return { overlay:c.toDataURL(), meanAbsoluteRGB:error/(1920*1080*3), silhouetteMismatchPercent:100*mismatch/(1920*1080) };
    })()`);
    writeFileSync(
      join(output, 'waves-overlay.png'),
      Buffer.from(comparison.overlay.split(',')[1], 'base64'),
    );
    delete comparison.overlay;
    console.log('Comparison', comparison);
    await client.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
    });
    await pause(200);
    assert.equal(
      await run("document.querySelectorAll('.public-animated-background animate').length"),
      7,
    );
    const continuity = await run(`(() => {
      const svg=document.querySelector('.public-animated-background'); svg.pauseAnimations();
      return [...svg.querySelectorAll('path')].map(path => {
        const duration=parseFloat(path.querySelector('animate').getAttribute('dur'));
        const sample=t => { svg.setCurrentTime(t); const length=path.getTotalLength(); return [0.1,0.2,0.3].map(f=>{const p=path.getPointAtLength(length*f);return [p.x,p.y];}); };
        const start=sample(0), end=sample(duration), middle=sample(duration/4);
        const distance=(a,b)=>Math.max(...a.map((p,i)=>Math.hypot(p[0]-b[i][0],p[1]-b[i][1])));
        return { loop:distance(start,end), motion:distance(start,middle) };
      });
    })()`);
    for (const wave of continuity) {
      assert.ok(wave.loop < 0.1, 'Continuous cycle');
      assert.ok(wave.motion > 0.1, 'Geometry actually interpolates');
    }
    for (const time of [0, 7, 15, 23, 33, 60]) {
      await run(
        `document.querySelector('.public-animated-background').pauseAnimations(); document.querySelector('.public-animated-background').setCurrentTime(${time})`,
      );
      await capture(`waves-time-${time}`);
    }
    await run("document.documentElement.dataset.tema='morado'");
    await capture('waves-purple');
    await run("document.getElementById('background-only').remove()");
    await capture('waves-full-purple');
    await client.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await pause(200);
    assert.equal(
      await run("document.querySelectorAll('.public-animated-background animate').length"),
      0,
    );
    console.log('PASS: native morph, live reduced motion, blue and purple captures');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
}
void verify();
