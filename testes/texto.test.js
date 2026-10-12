// testes/texto.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, palavras, distancia, cortar } from '../src/nucleo/texto.js';

test('normalizar tira acento, pontuação e caixa', () => {
  assert.equal(normalizar('  Orem pela minha ANSIEDADE!!  '), 'orem pela minha ansiedade');
  assert.equal(normalizar('Família, saúde e fé'), 'familia saude e fe');
});
test('palavras ignora emoji e vazios', () => {
  assert.deepEqual(palavras('🙏🙏 amém, irmão'), ['amem', 'irmao']);
  assert.deepEqual(palavras('🙏🔥'), []);
});
test('distancia', () => {
  assert.equal(distancia('ansiedad', 'ansiedade'), 1);
  assert.equal(distancia('familia', 'familia'), 0);
  assert.equal(distancia('medo', 'cura'), 4);
});
test('cortar', () => {
  assert.equal(cortar('abc', 22), 'abc');
  assert.equal(cortar('a'.repeat(30), 22), 'a'.repeat(21) + '…');
  assert.equal([...cortar('😀'.repeat(30), 22)].length, 22);
});
