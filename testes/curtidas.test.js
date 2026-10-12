import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCurtidas } from '../src/nucleo/curtidas.js';

test('bate a meta e avança', () => {
  const c = criarCurtidas({ meta: 1000 });
  assert.deepEqual(c.somar(600), { total: 600, meta: 1000, bateuMeta: false });
  assert.deepEqual(c.somar(500), { total: 1100, meta: 2000, bateuMeta: true });
});
test('pular duas metas comemora uma vez', () => {
  const c = criarCurtidas({ meta: 1000 });
  assert.deepEqual(c.somar(2500), { total: 2500, meta: 3000, bateuMeta: true });
});
test('definirMeta recalcula', () => {
  const c = criarCurtidas({ meta: 1000 }); c.somar(1200);
  c.definirMeta(500); assert.equal(c.estado().meta, 1500);
});
test('total exatamente igual a múltiplo do passo avança para o próximo múltiplo', () => {
  const c = criarCurtidas({ meta: 1000 });
  assert.deepEqual(c.somar(2000), { total: 2000, meta: 3000, bateuMeta: true });
});
