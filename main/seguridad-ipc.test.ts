import assert from 'node:assert/strict';
import test from 'node:test';
import {
  autorizarIpc,
  validarAccion,
  validarCantidad,
  validarCategoria,
  validarCategoriaOpcional,
  validarMensaje,
  validarSalud,
  validarSinArgumentos,
  validarUrlContenido,
  validarVolumen,
  validarYouTube,
} from './seguridad-ipc.js';

const urls = {
  operador: 'turnero://app/vistas/operador/index.html',
  publica: 'turnero://app/vistas/publica/index.html',
};
const crearRemitente = (url: string) => ({ getURL: () => url, mainFrame: { url } });
const operador = crearRemitente(urls.operador);
const publica = crearRemitente(urls.publica);
const rolOperador = (remitente: typeof operador) => remitente === operador;
const rolPublica = (remitente: typeof operador) => remitente === publica;
const urlVista = (vista: 'operador' | 'publica') => urls[vista];
const autorizar = (
  remitente: typeof operador,
  frame: { url: string } | null,
  vista: 'operador' | 'publica' | 'cualquiera',
) =>
  autorizarIpc({ sender: remitente, senderFrame: frame }, vista, rolOperador, rolPublica, urlVista);

test('IPC admite cada vista solo para su función y el estado para ambas', () => {
  assert.equal(autorizar(operador, operador.mainFrame, 'operador'), 'operador');
  assert.equal(autorizar(publica, publica.mainFrame, 'publica'), 'publica');
  assert.equal(autorizar(publica, publica.mainFrame, 'cualquiera'), 'publica');
  assert.deepEqual(validarAccion({ tipo: 'LLAMAR', entrada: '42' }), {
    tipo: 'LLAMAR',
    entrada: '42',
  });
  assert.equal(validarCategoria('videos'), 'videos');
  assert.equal(validarCategoriaOpcional(undefined), undefined);
  assert.deepEqual(validarVolumen(0.5, 800), [0.5, 800]);
  assert.equal(validarYouTube(null), null);
  assert.equal(validarMensaje('Listo'), 'Listo');
  assert.deepEqual(validarSalud('audio', 'correcto'), ['audio', 'correcto']);
  validarSinArgumentos([]);
  validarCantidad(['videos'], 1);
});

test('IPC rechaza remitente, marco y página ajenos', () => {
  const ajeno = crearRemitente(urls.operador);
  assert.throws(() => autorizar(ajeno, ajeno.mainFrame, 'cualquiera'), /Vista no autorizada/);
  assert.throws(() => autorizar(publica, publica.mainFrame, 'operador'), /Vista no autorizada/);
  assert.throws(
    () => autorizar(operador, { url: urls.operador }, 'operador'),
    /Marco no autorizado/,
  );
  assert.throws(() => autorizar(operador, null, 'operador'), /Marco no autorizado/);
  const otraPagina = crearRemitente('https://example.org/');
  assert.throws(
    () =>
      autorizarIpc(
        { sender: otraPagina, senderFrame: otraPagina.mainFrame },
        'operador',
        () => true,
        () => false,
        urlVista,
      ),
    /Página no autorizada/,
  );
  assert.throws(() => validarSinArgumentos(['extra']), /Argumentos no válidos/);
  assert.throws(() => validarCantidad([], 1), /Argumentos no válidos/);
});

test('IPC rechaza acciones, categorías y enlaces inválidos', () => {
  for (const accion of [null, [], { tipo: 'LLAMAR', entrada: 12 }, { tipo: 'QUITAR', n: 100 }])
    assert.throws(() => validarAccion(accion), /Acción no válida/);
  assert.throws(() => validarCategoria('voz'), /Categoría multimedia no válida/);
  for (const url of [
    'https://example.org/video',
    'http://youtube.com/watch?v=abc',
    'https://youtube.com.evil/watch?v=M7lc1UVf-VE',
  ])
    assert.throws(() => validarYouTube(url), /Enlace de YouTube no válido/);
  assert.equal(
    validarUrlContenido('turnero://app/contenido/videos/a.mp4'),
    'turnero://app/contenido/videos/a.mp4',
  );
  for (const url of [
    'file:///C:/secreto.txt',
    'turnero://app/contenido/voz/40.wav',
    'turnero://app/contenido/videos/%2e%2e%2fsecreto.mp4',
    'turnero://app/contenido/videos/a.mp4?x=1',
  ])
    assert.throws(() => validarUrlContenido(url), /Archivo multimedia no válido/);
});

test('IPC rechaza volumen, rampa y registros fuera de rango', () => {
  for (const volumen of [-0.1, 1.1, Number.NaN, '1'])
    assert.throws(() => validarVolumen(volumen, 0), /Volumen no válido/);
  for (const rampa of [-1, 2001, Number.POSITIVE_INFINITY, '100'])
    assert.throws(() => validarVolumen(1, rampa), /Rampa no válida/);
  assert.throws(() => validarMensaje('x'.repeat(501)), /Mensaje de registro no válido/);
  assert.throws(() => validarMensaje({ mensaje: 'x' }), /Mensaje de registro no válido/);
  assert.throws(() => validarSalud('disco', 'correcto'), /Tipo de salud no válido/);
  assert.throws(() => validarSalud('audio', 'otro'), /Estado de salud no válido/);
});
