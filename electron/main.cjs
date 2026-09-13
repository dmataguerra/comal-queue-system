const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');

const port = 3001;
const serverUrl = `http://127.0.0.1:${port}`;
let serverProcess;
let isQuitting = false;

function appRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked')
    : app.getAppPath();
}

function startServer() {
  const serverPath = path.join(appRoot(), 'build', 'server', 'main.js');
  const musicPath = app.isPackaged
    ? path.join(process.resourcesPath, 'data', 'music')
    : path.join(appRoot(), 'data', 'music');

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: appRoot(),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_PATH: path.join(app.getPath('userData'), 'comal.sqlite'),
      MUSIC_PATH: musicPath,
    },
  });

  serverProcess.stdout.on('data', (data) => console.log(`[server] ${data}`));
  serverProcess.stderr.on('data', (data) => console.error(`[server] ${data}`));
  serverProcess.on('error', (error) => console.error('No se pudo iniciar el servidor local:', error));
  serverProcess.on('exit', (code) => {
    if (!isQuitting && code !== 0) console.error(`El servidor local terminó con código ${code}.`);
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${serverUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // The server may need a few moments to initialize.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('El servidor local no respondió a tiempo.');
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#011123',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await window.loadURL(serverUrl);
}

async function launch() {
  startServer();
  await waitForServer();
  await createWindow();
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });

  app.whenReady().then(launch).catch(async (error) => {
    console.error(error);
    await dialog.showMessageBox({
      type: 'error',
      title: 'Comal++',
      message: 'No se pudo iniciar Comal++.',
      detail: error instanceof Error ? error.message : String(error),
    });
    app.quit();
  });

  app.on('before-quit', () => {
    isQuitting = true;
    if (serverProcess && !serverProcess.killed) serverProcess.kill();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
