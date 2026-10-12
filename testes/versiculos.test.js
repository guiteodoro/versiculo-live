// testes/versiculos.test.js — usa EXEMPLO e aleatorio fixo () => 0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarVersiculos, validarDados } from '../src/nucleo/versiculos.js';
import { EXEMPLO } from '../src/nucleo/versiculos-exemplo.js';

test('tema por palavra-chave, sem acento e com erro de digitação', () => {
  const v = criarVersiculos(EXEMPLO, { aleatorio: () => 0 });
  assert.equal(v.temaDe('orem pela minha ANSIEDADE'), 'ansiedade');
  assert.equal(v.temaDe('ansiedad demais'), 'ansiedade');
  assert.equal(v.temaDe('minha familia'), 'familia');
  assert.equal(v.temaDe('boa noite'), 'geral');
  assert.equal(v.temaDe('🙏🙏'), 'geral');
});
test('empate fica com o primeiro tema do arquivo', () => {
  const v = criarVersiculos(EXEMPLO);
  assert.equal(v.temaDe('ansiedade na familia'), 'ansiedade'); // ansiedade vem antes em EXEMPLO
});
test('não repete enquanto houver opção', () => {
  const v = criarVersiculos(EXEMPLO, { aleatorio: () => 0 });
  const refs = [1, 2, 3].map(() => v.doTema('geral').ref);
  assert.equal(new Set(refs).size, 3);
});
test('tema esgotado repete o mais antigo', () => {
  const v = criarVersiculos(EXEMPLO, { aleatorio: () => 0 });
  const refs = [1, 2, 3, 4].map(() => v.doTema('geral').ref);
  assert.equal(refs[3], refs[0]);
});
test('validarDados recusa arquivo quebrado e tema vazio', () => {
  assert.equal(validarDados(EXEMPLO).ok, true);
  assert.equal(validarDados(null).ok, false);
  const semVers = structuredClone(EXEMPLO); semVers.temas[0].versiculos = [];
  const r = validarDados(semVers);
  assert.equal(r.ok, false); assert.match(r.erro, /ansiedade/);
  const semGeral = { temas: EXEMPLO.temas.filter(t => t.id !== 'geral') };
  assert.equal(validarDados(semGeral).ok, false);
});
test('escolher devolve versículo do tema do comentário; doTema desconhecido cai em geral', () => {
  const v = criarVersiculos(EXEMPLO, { aleatorio: () => 0 });
  const a = v.escolher('estou com ansiedade');
  assert.equal(a.tema, 'ansiedade');
  assert.ok(a.ref && a.texto);
  assert.equal(v.doTema('nao-existe').tema, 'geral');
});
