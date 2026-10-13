import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarDiretor } from '../src/nucleo/diretor.js';
import { criarVersiculos } from '../src/nucleo/versiculos.js';
import { EXEMPLO } from '../src/nucleo/versiculos-exemplo.js';
import { criarFiltro } from '../src/nucleo/filtro.js';
import { PADRAO } from '../src/nucleo/config.js';

const usuario = (id, extra = {}) => ({ id, arroba: id, nome: id, foto: `${id}.jpg`, ...extra });
const c = (id, texto = 'oi', extra) => ({ tipo: 'comentario', usuario: usuario(id, extra), texto });
const p = (id, extra) => ({
  tipo: 'presente',
  usuario: usuario(id, extra),
  presente: { nome: 'Rosa', quantidade: 10, diamantes: 10, imagem: 'rosa.png' },
});
const s = (id, extra) => ({ tipo: 'seguiu', usuario: usuario(id, extra) });
const k = (quantidade) => ({ tipo: 'curtidas', usuario: usuario('x'), quantidade });

function novo(t, config = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const msgs = [];
  const diretor = criarDiretor({
    versiculos: criarVersiculos(EXEMPLO, { aleatorio: () => 0 }),
    filtro: criarFiltro('idiota'),
    config: { ...PADRAO, ...config },
    mostrar: (m) => msgs.push(m),
  });
  t.after(() => diretor.parar());
  const de = (canal) => msgs.filter((m) => m.canal === canal);
  return { diretor, msgs, de, cartoes: () => de('cartao'), limpar: () => (msgs.length = 0) };
}

test('comentário vira cartão de 8 s com versículo do tema', (t) => {
  const { diretor, cartoes, de } = novo(t);
  diretor.receber(c('ana', 'estou com muita ansiedade'));
  assert.equal(cartoes().length, 1);
  const [m] = cartoes();
  assert.equal(m.tipo, 'comentario');
  assert.equal(m.usuario.arroba, 'ana');
  assert.equal(m.versiculo.tema, 'ansiedade');
  assert.equal(m.versiculo.ref, 'Filipenses 4:6');
  assert.equal(m.duracaoMs, 8000);
  assert.deepEqual(m.aSeguir, { arrobas: [], resto: 0 });
  assert.deepEqual(
    de('registro').map((r) => r.texto),
    ['💬 @ana: "estou com muita ansiedade" → Filipenses 4:6'],
  );

  diretor.receber(c('bia', 'obrigado'));
  assert.equal(cartoes().length, 1, 'segundo espera o primeiro acabar');
  t.mock.timers.tick(7999);
  assert.equal(cartoes().length, 1);
  t.mock.timers.tick(1);
  assert.equal(cartoes().length, 2);
  assert.equal(cartoes()[1].usuario.arroba, 'bia');
  assert.equal(cartoes()[1].versiculo.tema, 'gratidao');
});

test('comentário vazio é ignorado e só-emoji vira geral', (t) => {
  const { diretor, msgs, cartoes } = novo(t);
  diretor.receber(c('ana', ''));
  diretor.receber(c('bia', '    '));
  assert.equal(msgs.length, 0);
  diretor.receber(c('caio', '🙏🙏❤️'));
  assert.equal(cartoes().length, 1);
  assert.equal(cartoes()[0].usuario.arroba, 'caio');
  assert.equal(cartoes()[0].versiculo.tema, 'geral');
});

test('presente interrompe comentário e o comentário volta depois', (t) => {
  const { diretor, cartoes } = novo(t);
  diretor.receber(c('ana', 'minha familia'));
  const versoAna = cartoes()[0].versiculo;
  assert.equal(versoAna.tema, 'familia');
  t.mock.timers.tick(2000);
  diretor.receber(p('bia'));
  assert.equal(cartoes().length, 2);
  const presente = cartoes()[1];
  assert.equal(presente.tipo, 'presente');
  assert.equal(presente.usuario.arroba, 'bia');
  assert.equal(presente.versiculo.tema, 'gratidao');
  assert.equal(presente.duracaoMs, 12000);
  assert.equal(presente.presente.nome, 'Rosa');
  assert.deepEqual(presente.aSeguir, { arrobas: ['ana'], resto: 0 });

  t.mock.timers.tick(11999);
  assert.equal(cartoes().length, 2);
  t.mock.timers.tick(1);
  assert.equal(cartoes().length, 3);
  const volta = cartoes()[2];
  assert.equal(volta.tipo, 'comentario');
  assert.equal(volta.usuario.arroba, 'ana');
  assert.deepEqual(volta.versiculo, versoAna, 'mantém o versículo escolhido');
  assert.equal(volta.duracaoMs, 8000, 'tempo cheio de novo');
});

test('presente não interrompe outro presente', (t) => {
  const { diretor, cartoes } = novo(t);
  diretor.receber(p('ana'));
  t.mock.timers.tick(3000);
  diretor.receber(p('bia'));
  assert.equal(cartoes().length, 1);
  t.mock.timers.tick(8999);
  assert.equal(cartoes().length, 1);
  t.mock.timers.tick(1);
  assert.equal(cartoes().length, 2);
  assert.equal(cartoes()[1].tipo, 'presente');
  assert.equal(cartoes()[1].usuario.arroba, 'bia');
});

test('meta entra depois do cartão atual e antes da fila', (t) => {
  const { diretor, cartoes, de } = novo(t);
  diretor.receber(c('ana', 'oi'));
  diretor.receber(c('bia', 'oi'));
  diretor.receber(k(600));
  diretor.receber(k(500));
  assert.equal(cartoes().length, 1, 'meta espera o cartão atual');
  t.mock.timers.tick(8000);
  assert.equal(cartoes().length, 2);
  const meta = cartoes()[1];
  assert.equal(meta.tipo, 'meta');
  assert.equal(meta.meta, 1000);
  assert.equal(meta.versiculo.tema, 'comunidade');
  assert.equal(meta.duracaoMs, 10000);
  assert.ok(de('registro').some((r) => r.texto === '❤ meta de 1000 curtidas!'));

  diretor.receber(p('caio'));
  assert.equal(cartoes().length, 2, 'presente espera a meta');
  t.mock.timers.tick(10000);
  assert.equal(cartoes()[2].tipo, 'presente');
  assert.equal(cartoes()[2].usuario.arroba, 'caio');
  t.mock.timers.tick(12000);
  assert.equal(cartoes()[3].usuario.arroba, 'bia');
});

test('meta sem cartão na tela entra na hora', (t) => {
  const { diretor, cartoes } = novo(t);
  diretor.receber(k(1000));
  assert.equal(cartoes().length, 1);
  assert.equal(cartoes()[0].tipo, 'meta');
  assert.equal(cartoes()[0].meta, 1000);
});

test('faixa de seguidor: uma por pessoa e no máximo 3 pendentes', (t) => {
  const { diretor, de, cartoes } = novo(t);
  diretor.receber(c('zeca', 'oi'));
  diretor.receber(s('ana'));
  diretor.receber(s('ana'));
  for (const id of ['b', 'c', 'd', 'e']) diretor.receber(s(id));
  assert.equal(cartoes().length, 1, 'faixa não mexe no cartão');
  assert.equal(de('faixa').length, 1);
  const [f] = de('faixa');
  assert.equal(f.usuario.arroba, 'ana');
  assert.equal(f.versiculo.tema, 'boas-vindas');
  assert.equal(f.duracaoMs, 5000);

  for (let i = 0; i < 10; i++) t.mock.timers.tick(5000);
  assert.deepEqual(de('faixa').map((m) => m.usuario.arroba), ['ana', 'b', 'c', 'd']);

  diretor.receber(s('ana'));
  diretor.receber(s('e'));
  assert.deepEqual(de('faixa').map((m) => m.usuario.arroba), ['ana', 'b', 'c', 'd', 'e']);
});

test('@ bloqueado: comentário ignorado, presente como anônimo', (t) => {
  const { diretor, cartoes, de } = novo(t);
  diretor.receber(c('idiota_123', 'oi', { arroba: 'idiota 123' }));
  diretor.receber(c('ana', 'você é idiota'));
  diretor.receber(s('x', { nome: 'idiota' }));
  assert.equal(cartoes().length, 0);
  assert.equal(de('faixa').length, 0);
  assert.equal(de('registro').length, 3);
  assert.ok(de('registro').every((r) => r.texto.startsWith('🚫')));

  const evento = p('idiota_123', { arroba: 'idiota 123' });
  diretor.receber(evento);
  assert.equal(cartoes().length, 1);
  assert.equal(cartoes()[0].usuario.arroba, 'anônimo');
  assert.equal(cartoes()[0].usuario.nome, 'anônimo');
  assert.equal(cartoes()[0].usuario.foto, null);
  assert.equal(evento.usuario.arroba, 'idiota 123', 'não altera o evento recebido');
});

test('presente que interrompe comentário entra antes da meta pendente', (t) => {
  const { diretor, cartoes } = novo(t);
  diretor.receber(c('ana', 'minha familia'));
  t.mock.timers.tick(1000);
  diretor.receber(k(1000));
  assert.equal(cartoes().length, 1, 'meta não interrompe o comentário');
  diretor.receber(p('bia'));
  assert.equal(cartoes().length, 2);
  assert.equal(cartoes()[1].tipo, 'presente');
  assert.equal(cartoes()[1].usuario.arroba, 'bia');
  t.mock.timers.tick(12000);
  assert.equal(cartoes()[2].tipo, 'meta');
  assert.equal(cartoes()[2].meta, 1000);
  t.mock.timers.tick(10000);
  assert.equal(cartoes()[3].tipo, 'comentario');
  assert.equal(cartoes()[3].usuario.arroba, 'ana');
  assert.equal(cartoes()[3].duracaoMs, 8000);
});

test('@ longo é cortado em 22 caracteres', (t) => {
  const { diretor, cartoes } = novo(t);
  const evento = c('l', 'oi', { arroba: 'a'.repeat(30) });
  diretor.receber(evento);
  assert.equal(cartoes()[0].usuario.arroba, 'a'.repeat(21) + '…');
  assert.equal(evento.usuario.arroba, 'a'.repeat(30));
});

test('curtidas atualizam a barra', (t) => {
  const { diretor, de } = novo(t, { metaCurtidas: 100 });
  diretor.receber(k(30));
  diretor.receber(k(50));
  assert.deepEqual(de('curtidas').map(({ total, meta }) => ({ total, meta })), [
    { total: 30, meta: 100 },
    { total: 80, meta: 100 },
  ]);
  diretor.receber(k(25));
  assert.deepEqual(de('curtidas').at(-1), { canal: 'curtidas', total: 105, meta: 200, passo: 100 });
  const meta = de('cartao').at(-1);
  assert.equal(meta.tipo, 'meta');
  assert.equal(meta.meta, 100);
  diretor.atualizarConfig({ ...PADRAO, metaCurtidas: 50 });
  assert.deepEqual(de('curtidas').at(-1), { canal: 'curtidas', total: 105, meta: 150, passo: 50 });
});

test('aSeguir acompanha o cartão', (t) => {
  const { diretor, cartoes, de } = novo(t);
  for (const id of ['ana', 'bia', 'caio', 'davi', 'eva', 'fabi']) diretor.receber(c(id, 'oi'));
  assert.deepEqual(cartoes()[0].aSeguir, { arrobas: [], resto: 0 });
  assert.equal(de('fila').at(-1).tamanho, 5);
  t.mock.timers.tick(8000);
  assert.equal(cartoes()[1].usuario.arroba, 'bia');
  assert.deepEqual(cartoes()[1].aSeguir, { arrobas: ['caio', 'davi', 'eva'], resto: 1 });
  assert.equal(de('fila').at(-1).tamanho, 4);
  // tamanho só é emitido quando muda
  const tamanhos = de('fila').map((m) => m.tamanho);
  for (let i = 1; i < tamanhos.length; i++) assert.notEqual(tamanhos[i], tamanhos[i - 1]);
});

test('reiniciar zera fila, curtidas, seguidores vistos e o cartão atual', (t) => {
  const { diretor, msgs, cartoes, de, limpar } = novo(t);
  diretor.receber(c('ana', 'oi'));
  diretor.receber(c('bia', 'oi'));
  diretor.receber(s('caio'));
  diretor.receber(k(400));
  limpar();
  diretor.reiniciar();
  assert.deepEqual(msgs, [
    { canal: 'curtidas', total: 0, meta: 1000, passo: 1000 },
    { canal: 'fila', tamanho: 0 },
    { canal: 'agradecidos', arrobas: [] },
  ]);
  for (let i = 0; i < 10; i++) t.mock.timers.tick(8000);
  assert.equal(cartoes().length, 0, 'bia não aparece mais');
  diretor.receber(s('caio'));
  assert.equal(de('faixa').length, 1);
  diretor.receber(c('dani', 'oi'));
  assert.equal(cartoes().length, 1, 'cartão novo entra na hora');
  diretor.receber(k(10));
  assert.deepEqual(de('curtidas').at(-1), { canal: 'curtidas', total: 10, meta: 1000, passo: 1000 });
});

test('parar cancela timers e ignora eventos', (t) => {
  const { diretor, msgs } = novo(t);
  diretor.receber(c('ana', 'oi'));
  diretor.receber(c('bia', 'oi'));
  diretor.parar();
  const n = msgs.length;
  for (let i = 0; i < 10; i++) t.mock.timers.tick(8000);
  diretor.receber(c('caio', 'oi'));
  diretor.receber(k(5000));
  assert.equal(msgs.length, n);
});

test('presente de quem não tem @ nem nome não se perde', (t) => {
  const { diretor, cartoes, de } = novo(t);
  diretor.receber({
    tipo: 'presente',
    usuario: { id: 'desconhecido', arroba: undefined, nome: undefined, foto: null },
    presente: { nome: 'Rosa', quantidade: 1, diamantes: 1, imagem: null },
  });
  assert.equal(cartoes().length, 1);
  assert.equal(cartoes()[0].tipo, 'presente');
  assert.equal(typeof cartoes()[0].usuario.arroba, 'string');
  assert.equal(de('registro').length, 1);
});

test('mural: presente entra quando o cartão dourado aparece, mais recente primeiro', (t) => {
  const { diretor, de } = novo(t);
  diretor.receber(p('ana'));
  assert.deepEqual(de('agradecidos').at(-1), { canal: 'agradecidos', arrobas: ['ana'] });
  diretor.receber(p('bia'));
  assert.equal(de('agradecidos').length, 1, 'bia ainda espera o cartão de ana acabar');
  t.mock.timers.tick(12000);
  assert.deepEqual(de('agradecidos').at(-1).arrobas, ['bia', 'ana']);
});

test('mural: cada pessoa uma vez só, no máximo 5', (t) => {
  const { diretor, de } = novo(t);
  for (const id of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a2']) {
    diretor.receber(p(id));
    t.mock.timers.tick(12000);
  }
  assert.deepEqual(de('agradecidos').at(-1).arrobas, ['a2', 'a6', 'a5', 'a4', 'a3']);
});

test('mural: anônimo não entra', (t) => {
  const { diretor, de } = novo(t);
  diretor.receber(p('idiota'));
  assert.equal(de('cartao').at(-1).usuario.arroba, 'anônimo');
  assert.equal(de('agradecidos').length, 0);
});

test('mural: @ longo vai cortado como no cartão', (t) => {
  const { diretor, de } = novo(t);
  diretor.receber(p('l', { arroba: 'b'.repeat(30) }));
  assert.deepEqual(de('agradecidos').at(-1).arrobas, ['b'.repeat(21) + '…']);
});

test('mural: reiniciar zera a lista', (t) => {
  const { diretor, de } = novo(t);
  diretor.receber(p('ana'));
  diretor.reiniciar();
  assert.deepEqual(de('agradecidos').at(-1).arrobas, []);
  diretor.receber(p('bia'));
  assert.deepEqual(de('agradecidos').at(-1).arrobas, ['bia']);
});

test('curtidas informam o passo da meta configurada', (t) => {
  const { diretor, de } = novo(t, { metaCurtidas: 500 });
  diretor.receber(k(10));
  assert.deepEqual(de('curtidas').at(-1), { canal: 'curtidas', total: 10, meta: 500, passo: 500 });
});
