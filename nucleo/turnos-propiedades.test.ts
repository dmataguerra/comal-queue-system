import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ESTADO_INICIAL,
  deshacer,
  enPantalla,
  llamar,
  normalizar,
  quitar,
  vencer,
  type Estado,
} from './turnos.js';
test('todos los tickets de hasta seis dígitos anuncian exactamente su terminación 00–99', () => {
  for (let ticket = 0; ticket < 1000000; ticket++) {
    assert.equal(normalizar(String(ticket)), ticket % 100);
    assert.equal(normalizar(String(ticket).padStart(6, '0')), ticket % 100);
  }
});
test('20.000 transiciones reproducibles coinciden con el modelo de seis turnos y corrección', () => {
  for (const initialSeed of [1, 42, 0xc0a1, 0xffffffff]) {
    let seed = initialSeed;
    const random = (max: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed >>> 8) % max;
    };
    let estado: Estado = ESTADO_INICIAL;
    let pantalla: number[] = [];
    let correccion: number[] | null = null;
    for (let i = 0; i < 5000; i++) {
      const n = random(100);
      const accion = random(6);
      const previo = structuredClone(estado);
      Object.freeze(estado.llamados);
      if (estado.deshacer) Object.freeze(estado.deshacer.llamados);
      Object.freeze(estado);
      let siguiente;
      if (accion <= 1) {
        siguiente = llamar(estado, String(100000 + n));
        if (pantalla[0] !== n) {
          correccion = [...pantalla];
          pantalla = [n, ...pantalla.filter((turno) => turno !== n)].slice(0, 6);
        }
        assert.deepEqual(siguiente.efecto, { tipo: 'ANUNCIAR', n });
      } else if (accion === 2) {
        siguiente = quitar(estado, n);
        if (pantalla.includes(n)) {
          pantalla = pantalla.filter((turno) => turno !== n);
          correccion = null;
        }
        assert.equal(siguiente.efecto, null);
      } else if (accion === 3) {
        siguiente = deshacer(estado);
        if (correccion) pantalla = [...correccion];
        correccion = null;
        assert.equal(siguiente.efecto, null);
      } else if (accion === 4) {
        const vencidos = [n, random(100), random(100)];
        siguiente = vencer(estado, vencidos);
        if (pantalla.length && vencidos.includes(pantalla[0])) correccion = null;
        pantalla = pantalla.filter((turno) => !vencidos.includes(turno));
        assert.equal(siguiente.efecto, null);
      } else {
        siguiente = llamar(estado, ['1234567', '-1', '12x', '１２', '', 'NaN'][random(6)]);
        assert.equal(siguiente.efecto?.tipo, 'CAPTURA_INVALIDA');
      }
      const contexto = `seed=${initialSeed}, paso=${i}, accion=${accion}, numero=${n}`;
      assert.deepEqual(estado, previo, `No debe mutar el estado anterior: ${contexto}`);
      estado = siguiente.estado;
      assert.deepEqual(enPantalla(estado), pantalla, contexto);
      assert.equal(estado.deshacer !== null, correccion !== null, contexto);
      assert.ok(pantalla.length <= 6, contexto);
      assert.equal(new Set(pantalla).size, pantalla.length, contexto);
    }
  }
});
