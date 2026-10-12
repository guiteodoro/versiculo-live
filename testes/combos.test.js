import test from 'node:test';
import assert from 'node:assert/strict';
import { criarCombos } from '../src/nucleo/combos.js';

const usuario = { id: 'u1', arroba: '@ana', nome: 'Ana', foto: '' };
const bruto = (nome, quantidade, sequencia, fim) => ({
  tipo: 'presente-bruto',
  usuario,
  presente: { nome, quantidade, diamantes: 1, imagem: '' },
  sequencia,
  fim,
});

function preparar(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const emitidos = [];
  const combos = criarCombos({ emitir: (e) => emitidos.push(e) });
  return { emitidos, combos };
}

test('presente sem sequência sai na hora', (t) => {
  const { emitidos, combos } = preparar(t);
  combos.receber(bruto('Rosa', 1, false, false));
  assert.equal(emitidos.length, 1);
  assert.equal(emitidos[0].tipo, 'presente');
  assert.deepEqual(emitidos[0].usuario, usuario);
  assert.equal(emitidos[0].presente.nome, 'Rosa');
  assert.equal(emitidos[0].presente.quantidade, 1);
  combos.parar();
});

test('combo emite uma vez no fim com a quantidade final', (t) => {
  const { emitidos, combos } = preparar(t);
  for (let q = 1; q <= 10; q++) combos.receber(bruto('Rosa', q, true, false));
  assert.equal(emitidos.length, 0);
  combos.receber(bruto('Rosa', 10, true, true));
  assert.equal(emitidos.length, 1);
  assert.deepEqual(emitidos[0].usuario, usuario);
  assert.equal(emitidos[0].presente.nome, 'Rosa');
  assert.equal(emitidos[0].presente.quantidade, 10);
  t.mock.timers.tick(10000);
  assert.equal(emitidos.length, 1);
  combos.parar();
});

test('combo sem aviso de fim fecha após 5 s', (t) => {
  const { emitidos, combos } = preparar(t);
  combos.receber(bruto('Rosa', 3, true, false));
  t.mock.timers.tick(4999);
  assert.equal(emitidos.length, 0);
  t.mock.timers.tick(1);
  assert.equal(emitidos.length, 1);
  assert.deepEqual(emitidos[0].usuario, usuario);
  assert.equal(emitidos[0].presente.nome, 'Rosa');
  assert.equal(emitidos[0].presente.quantidade, 3);
  combos.parar();
});

test('dois combos da mesma pessoa com presentes diferentes', (t) => {
  const { emitidos, combos } = preparar(t);
  combos.receber(bruto('Rosa', 1, true, false));
  combos.receber(bruto('Coração', 1, true, false));
  combos.receber(bruto('Rosa', 2, true, false));
  combos.receber(bruto('Coração', 4, true, false));
  combos.receber(bruto('Rosa', 3, true, true));
  combos.receber(bruto('Coração', 4, true, true));
  assert.equal(emitidos.length, 2);
  const rosa = emitidos.find((e) => e.presente.nome === 'Rosa');
  const coracao = emitidos.find((e) => e.presente.nome === 'Coração');
  assert.equal(rosa.presente.quantidade, 3);
  assert.equal(coracao.presente.quantidade, 4);
  assert.deepEqual(rosa.usuario, usuario);
  assert.deepEqual(coracao.usuario, usuario);
  combos.parar();
});

test('fim sem combo pendente emite uma vez', (t) => {
  const { emitidos, combos } = preparar(t);
  combos.receber(bruto('Rosa', 1, true, true));
  assert.equal(emitidos.length, 1);
  assert.equal(emitidos[0].presente.quantidade, 1);
  combos.parar();
});

test('parar cancela os timers sem emitir', (t) => {
  const { emitidos, combos } = preparar(t);
  combos.receber(bruto('Rosa', 3, true, false));
  combos.parar();
  t.mock.timers.tick(10000);
  assert.equal(emitidos.length, 0);
});
