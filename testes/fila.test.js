import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarFila } from '../src/nucleo/fila.js';

const usuario = (id) => ({ id, arroba: id, nome: id, foto: '' });
const c = (id, texto = 'oi') => ({ tipo: 'comentario', usuario: usuario(id), texto });
const p = (id) => ({ tipo: 'presente', usuario: usuario(id), presente: { nome: 'Rosa' } });

function nova(opcoes = {}) {
  const relogio = { t: 0 };
  const fila = criarFila({ esperaMs: 300000, agora: () => relogio.t, ...opcoes });
  return { fila, relogio };
}

test('presente sai antes de comentário', () => {
  const { fila } = nova();
  const c1 = c('ana');
  const p1 = p('bia');
  fila.adicionarComentario(c1);
  fila.adicionarPresente(p1);
  assert.equal(fila.proximo(), p1);
  assert.equal(fila.proximo(), c1);
  assert.equal(fila.proximo(), null);
});

test('espera por pessoa conta da entrada na fila', () => {
  const { fila, relogio } = nova();
  assert.equal(fila.adicionarComentario(c('ana')), true);
  relogio.t = 299999;
  assert.equal(fila.adicionarComentario(c('ana')), false);
  relogio.t = 300000;
  assert.equal(fila.adicionarComentario(c('ana')), true);
  assert.equal(fila.tamanho(), 2);
});

test('presente ignora a espera e não a altera', () => {
  const { fila, relogio } = nova();
  assert.equal(fila.adicionarComentario(c('ana')), true);
  relogio.t = 1;
  fila.adicionarPresente(p('ana'));
  relogio.t = 2;
  assert.equal(fila.adicionarComentario(c('ana')), false);
  assert.equal(fila.tamanho(), 2);
});

test('limite de 20 descarta o mais antigo', () => {
  const { fila } = nova();
  const eventos = [];
  for (let i = 0; i < 21; i++) {
    const e = c('u' + i);
    eventos.push(e);
    assert.equal(fila.adicionarComentario(e), true);
  }
  assert.equal(fila.tamanho(), 20);
  assert.equal(fila.proximo(), eventos[1]);
});

test('devolverComentario volta para o início', () => {
  const { fila } = nova();
  const a = c('ana');
  const b = c('bia');
  fila.adicionarComentario(a);
  fila.adicionarComentario(b);
  const saiu = fila.proximo();
  assert.equal(saiu, a);
  fila.devolverComentario(saiu);
  assert.equal(fila.tamanho(), 2);
  assert.equal(fila.proximo(), a);
  assert.equal(fila.proximo(), b);
});

test('devolverComentario não conta como nova entrada', () => {
  const { fila, relogio } = nova();
  const a = c('ana');
  fila.adicionarComentario(a);
  relogio.t = 1000;
  fila.devolverComentario(fila.proximo());
  relogio.t = 300000;
  // espera continua contando de t=0
  assert.equal(fila.adicionarComentario(c('ana')), true);
});

test('aSeguir lista os próximos n sem remover e informa o resto', () => {
  const { fila } = nova();
  fila.adicionarComentario(c('c1'));
  fila.adicionarComentario(c('c2'));
  fila.adicionarComentario(c('c3'));
  fila.adicionarComentario(c('c4'));
  fila.adicionarPresente(p('p1'));
  fila.adicionarPresente(p('p2'));
  const r = fila.aSeguir(3);
  assert.deepEqual(r, { arrobas: ['p1', 'p2', 'c1'], resto: 3 });
  assert.equal(fila.tamanho(), 6);
  assert.deepEqual(fila.aSeguir(10), { arrobas: ['p1', 'p2', 'c1', 'c2', 'c3', 'c4'], resto: 0 });
});

test('definirEspera muda o tempo para novas entradas', () => {
  const { fila, relogio } = nova();
  fila.adicionarComentario(c('ana'));
  fila.definirEspera(1000);
  relogio.t = 1000;
  assert.equal(fila.adicionarComentario(c('ana')), true);
});

test('descartar pelo limite não libera a espera de quem foi descartado', () => {
  const { fila, relogio } = nova({ maxComentarios: 2 });
  fila.adicionarComentario(c('a'));
  fila.adicionarComentario(c('b'));
  fila.adicionarComentario(c('c')); // descarta 'a'
  relogio.t = 10;
  assert.equal(fila.adicionarComentario(c('a')), false);
});
