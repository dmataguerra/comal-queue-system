import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authorizeIpc,
  validateAction,
  validateCount,
  validateCategory,
  validateOptionalCategory,
  validateMessage,
  validateHealth,
  validateNoArguments,
  validateContentUrl,
  validateVolume,
  validateVolumes,
  validateYouTube,
} from './ipc-validation.js';
const urls = {
  operador: 'turnero://app/views/operator/index.html',
  publica: 'turnero://app/views/display/index.html',
};
test('volumes: limits, silences and rejection of non-finite values', () => {
  assert.deepEqual(validateVolumes(0, 0), [0, 0]);
  assert.deepEqual(validateVolumes(3, 1), [3, 1]);
  for (const value of [NaN, Infinity, -1, '1', null, undefined]) {
    assert.throws(() => validateVolumes(value, 0.5));
    assert.throws(() => validateVolumes(1, value));
  }
  assert.throws(() => validateVolumes(3.1, 1));
  assert.throws(() => validateVolumes(1, 1.1));
});
const createSender = (url: string) => ({ getURL: () => url, mainFrame: { url } });
const operatorWindow = createSender(urls.operador);
const publicWindow = createSender(urls.publica);
const operatorRole = (sender: typeof operatorWindow) => sender === operatorWindow;
const publicRole = (sender: typeof operatorWindow) => sender === publicWindow;
const viewUrl = (view: 'operador' | 'publica') => urls[view];
const authorize = (
  sender: typeof operatorWindow,
  frame: {
    url: string;
  } | null,
  view: 'operador' | 'publica' | 'cualquiera',
) => authorizeIpc({ sender: sender, senderFrame: frame }, view, operatorRole, publicRole, viewUrl);
test('IPC allows each view only for its function and the state for both', () => {
  assert.equal(authorize(operatorWindow, operatorWindow.mainFrame, 'operador'), 'operador');
  assert.equal(authorize(publicWindow, publicWindow.mainFrame, 'publica'), 'publica');
  assert.equal(authorize(publicWindow, publicWindow.mainFrame, 'cualquiera'), 'publica');
  assert.deepEqual(validateAction({ tipo: 'LLAMAR', entrada: '42' }), {
    tipo: 'LLAMAR',
    entrada: '42',
  });
  assert.equal(validateCategory('videos'), 'videos');
  assert.equal(validateOptionalCategory(undefined), undefined);
  assert.deepEqual(validateVolume(0.5, 800), [0.5, 800]);
  assert.equal(validateYouTube(null), null);
  assert.equal(validateMessage('Listo'), 'Listo');
  assert.deepEqual(validateHealth('audio', 'correcto'), ['audio', 'correcto']);
  validateNoArguments([]);
  validateCount(['videos'], 1);
});
test('IPC rejects foreign sender, frame and page', () => {
  const foreign = createSender(urls.operador);
  assert.throws(() => authorize(foreign, foreign.mainFrame, 'cualquiera'), /Vista no autorizada/);
  assert.throws(
    () => authorize(publicWindow, publicWindow.mainFrame, 'operador'),
    /Vista no autorizada/,
  );
  assert.throws(
    () => authorize(operatorWindow, { url: urls.operador }, 'operador'),
    /Marco no autorizado/,
  );
  assert.throws(() => authorize(operatorWindow, null, 'operador'), /Marco no autorizado/);
  const otherPage = createSender('https://example.org/');
  assert.throws(
    () =>
      authorizeIpc(
        { sender: otherPage, senderFrame: otherPage.mainFrame },
        'operador',
        () => true,
        () => false,
        viewUrl,
      ),
    /Página no autorizada/,
  );
  assert.throws(() => validateNoArguments(['extra']), /Argumentos no válidos/);
  assert.throws(() => validateCount([], 1), /Argumentos no válidos/);
});
test('IPC rejects invalid actions, categories and links', () => {
  for (const action of [null, [], { tipo: 'LLAMAR', entrada: 12 }, { tipo: 'QUITAR', n: 100 }])
    assert.throws(() => validateAction(action), /Acción no válida/);
  assert.throws(() => validateCategory('voz'), /Categoría multimedia no válida/);
  for (const url of [
    'https://example.org/video',
    'http://youtube.com/watch?v=abc',
    'https://youtube.com.evil/watch?v=M7lc1UVf-VE',
  ])
    assert.throws(() => validateYouTube(url), /Enlace de YouTube no válido/);
  assert.equal(
    validateContentUrl('turnero://app/contenido/videos/a.mp4'),
    'turnero://app/contenido/videos/a.mp4',
  );
  for (const url of [
    'file:///C:/secreto.txt',
    'turnero://app/contenido/voz/40.wav',
    'turnero://app/contenido/videos/%2e%2e%2fsecreto.mp4',
    'turnero://app/contenido/videos/a.mp4?x=1',
  ])
    assert.throws(() => validateContentUrl(url), /Archivo multimedia no válido/);
});
test('IPC rejects out-of-range volume, ramp and log entries', () => {
  for (const volume of [-0.1, 1.1, Number.NaN, '1'])
    assert.throws(() => validateVolume(volume, 0), /Volumen no válido/);
  for (const ramp of [-1, 2001, Number.POSITIVE_INFINITY, '100'])
    assert.throws(() => validateVolume(1, ramp), /Rampa no válida/);
  assert.throws(() => validateMessage('x'.repeat(501)), /Mensaje de registro no válido/);
  assert.throws(() => validateMessage({ mensaje: 'x' }), /Mensaje de registro no válido/);
  assert.throws(() => validateHealth('disco', 'correcto'), /Tipo de salud no válido/);
  assert.throws(() => validateHealth('audio', 'otro'), /Estado de salud no válido/);
});
