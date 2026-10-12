import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PADRAO, normalizarConfig, lerConfig, salvarConfig } from '../src/nucleo/config.js';

async function comTemp(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vl-'));
  try { await fn(dir); } finally { await fs.rm(dir, { recursive: true, force: true }); }
}

test('padrões', () => {
  assert.deepEqual({ ...PADRAO }, {
    esperaMin: 5, tempoComentarioS: 8, tempoPresenteS: 12,
    tempoSeguidorS: 5, tempoMetaS: 10, metaCurtidas: 1000, arroba: '',
  });
  assert.ok(Object.isFrozen(PADRAO));
});

test('normalizar: entrada que não é objeto → padrão', () => {
  for (const x of [null, undefined, 5, 'a', [1]]) assert.deepEqual(normalizarConfig(x), PADRAO);
});

test('normalizar: fora dos limites ou tipo errado volta ao padrão', () => {
  assert.equal(normalizarConfig({ esperaMin: -3 }).esperaMin, 5);
  assert.equal(normalizarConfig({ esperaMin: 61 }).esperaMin, 5);
  assert.equal(normalizarConfig({ tempoComentarioS: '8' }).tempoComentarioS, 8);
  assert.equal(normalizarConfig({ tempoPresenteS: 1 }).tempoPresenteS, 12);
  assert.equal(normalizarConfig({ tempoSeguidorS: NaN }).tempoSeguidorS, 5);
  assert.equal(normalizarConfig({ tempoMetaS: Infinity }).tempoMetaS, 10);
  assert.equal(normalizarConfig({ metaCurtidas: 9 }).metaCurtidas, 1000);
  assert.equal(normalizarConfig({ metaCurtidas: 1000001 }).metaCurtidas, 1000);
  assert.equal(normalizarConfig({ arroba: 42 }).arroba, '');
});

test('normalizar: limites inclusivos e valores válidos mantidos', () => {
  const c = normalizarConfig({ esperaMin: 0, tempoComentarioS: 2, tempoPresenteS: 60, tempoSeguidorS: 2.5, tempoMetaS: 60, metaCurtidas: 10, arroba: 'fulano' });
  assert.deepEqual({ ...c }, { esperaMin: 0, tempoComentarioS: 2, tempoPresenteS: 60, tempoSeguidorS: 2.5, tempoMetaS: 60, metaCurtidas: 10, arroba: 'fulano' });
  assert.equal(normalizarConfig({ esperaMin: 60 }).esperaMin, 60);
  assert.equal(normalizarConfig({ metaCurtidas: 1000000 }).metaCurtidas, 1000000);
});

test('normalizar: campo extra some e entrada não é mutada', () => {
  const entrada = { esperaMin: 7, extra: 1 };
  const c = normalizarConfig(entrada);
  assert.ok(!('extra' in c));
  assert.deepEqual(entrada, { esperaMin: 7, extra: 1 });
  assert.notEqual(c, entrada);
  c.esperaMin = 9;
  assert.equal(PADRAO.esperaMin, 5);
});

test('lerConfig: arquivo inexistente ou JSON inválido → padrão', async () => {
  await comTemp(async (dir) => {
    assert.deepEqual(await lerConfig(path.join(dir, 'nada.json')), PADRAO);
    const ruim = path.join(dir, 'ruim.json');
    await fs.writeFile(ruim, '{lixo');
    assert.deepEqual(await lerConfig(ruim), PADRAO);
  });
});

test('salvarConfig grava, mescla e relê', async () => {
  await comTemp(async (dir) => {
    const arq = path.join(dir, 'sub', 'config.json');
    const r1 = await salvarConfig(arq, { esperaMin: 9, arroba: 'abc' });
    assert.equal(r1.esperaMin, 9);
    const r2 = await salvarConfig(arq, { tempoMetaS: 20, esperaMin: -1 });
    assert.equal(r2.arroba, 'abc');
    assert.equal(r2.tempoMetaS, 20);
    assert.equal(r2.esperaMin, 5);
    assert.deepEqual(await lerConfig(arq), r2);
    assert.match(await fs.readFile(arq, 'utf8'), /\n  "esperaMin"/);
  });
});
