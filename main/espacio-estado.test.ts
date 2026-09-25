import assert from 'node:assert/strict';
import test from 'node:test';
import { comprobarEspacioEstado, RESERVA_ESTADO } from './store.js';

test('guardado de estado rechaza disco bajo antes de escribir', () => {
  assert.throws(
    () => comprobarEspacioEstado('C:/datos/estado.json', () => RESERVA_ESTADO - 1),
    /Espacio insuficiente/,
  );
  assert.doesNotThrow(() => comprobarEspacioEstado('C:/datos/estado.json', () => RESERVA_ESTADO));
});

test('guardado tolera consulta de espacio no disponible pero conserva otros errores', () => {
  assert.doesNotThrow(() =>
    comprobarEspacioEstado('C:/datos/estado.json', () => {
      throw Object.assign(new Error('No compatible'), { code: 'ENOSYS' });
    }),
  );
  assert.throws(() =>
    comprobarEspacioEstado('C:/datos/estado.json', () => {
      throw Object.assign(new Error('Permiso denegado'), { code: 'EACCES' });
    }),
  );
});
