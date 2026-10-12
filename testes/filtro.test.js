// testes/filtro.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarFiltro } from '../src/nucleo/filtro.js';

test('bloqueia palavra e expressão inteiras, sem acento', () => {
  const f = criarFiltro('# comentário\nidiota\nvai se ferrar\n\n');
  assert.equal(f.bloqueia('Seu IDIOTA'), true);
  assert.equal(f.bloqueia('vai se ferrár'), true);
  assert.equal(f.bloqueia('idiotas'), false);
  assert.equal(f.bloqueia('boa noite'), false);
});
test('entrada curta não pega dentro de palavra', () => {
  assert.equal(criarFiltro('cu').bloqueia('preciso de cura'), false);
});
