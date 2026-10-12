import test from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulador, TEXTOS_COMENTARIO } from '../src/nucleo/simulador.js';

function preparar(aleatorio = () => 0) {
  const eventos = [];
  const sim = criarSimulador({ aoEvento: (e) => eventos.push(e), aleatorio });
  return { eventos, sim };
}

function verUsuario(u) {
  assert.match(u.id, /^teste-\d+$/);
  assert.equal(typeof u.arroba, 'string');
  assert.equal(typeof u.nome, 'string');
  assert.equal(u.foto, null);
}

test('comentario emite evento padrão com usuário de teste', () => {
  const { eventos, sim } = preparar();
  sim.comentario();
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].tipo, 'comentario');
  verUsuario(eventos[0].usuario);
  assert.equal(typeof eventos[0].texto, 'string');
  assert.ok(eventos[0].texto.length > 0);
});

test('comentario cobre ansiedade, família, gratidão, boa noite e 🙏🙏', () => {
  const junto = TEXTOS_COMENTARIO.join(' | ').toLowerCase();
  for (const trecho of ['ansiedade', 'família', 'gratidão', 'boa noite', '🙏🙏']) {
    assert.ok(junto.includes(trecho), `falta tema: ${trecho}`);
  }
  const { eventos, sim } = preparar();
  let i = 0;
  const n = TEXTOS_COMENTARIO.length;
  const sim2 = criarSimulador({ aoEvento: (e) => eventos.push(e), aleatorio: () => (i++ % n) / n });
  for (let k = 0; k < n; k++) sim2.comentario();
  assert.equal(new Set(eventos.map((e) => e.texto)).size, n);
  assert.ok(sim);
});

test('seguidor emite seguiu e muda de usuário em chamadas seguidas', () => {
  const { eventos, sim } = preparar();
  sim.seguidor();
  sim.seguidor();
  sim.seguidor();
  assert.deepEqual(eventos.map((e) => e.tipo), ['seguiu', 'seguiu', 'seguiu']);
  eventos.forEach((e) => verUsuario(e.usuario));
  assert.equal(new Set(eventos.map((e) => e.usuario.id)).size, 3);
});

test('curtidas emite quantidade (padrão 500) e totalDaLive null', () => {
  const { eventos, sim } = preparar();
  sim.curtidas();
  sim.curtidas(50);
  assert.equal(eventos[0].tipo, 'curtidas');
  assert.equal(eventos[0].quantidade, 500);
  assert.equal(eventos[1].quantidade, 50);
  assert.equal(eventos[0].totalDaLive, null);
  verUsuario(eventos[0].usuario);
});

test('presente emite 11 brutos da mesma pessoa, o último com fim', () => {
  const { eventos, sim } = preparar();
  sim.presente();
  assert.equal(eventos.length, 11);
  const ids = new Set(eventos.map((e) => e.usuario.id));
  assert.equal(ids.size, 1);
  verUsuario(eventos[0].usuario);
  eventos.forEach((e) => {
    assert.equal(e.tipo, 'presente-bruto');
    assert.deepEqual(
      { ...e.presente, quantidade: 0 },
      { nome: 'Rosa', quantidade: 0, diamantes: 1, imagem: null },
    );
  });
  for (let i = 0; i < 10; i++) {
    assert.equal(eventos[i].presente.quantidade, i + 1);
    assert.equal(eventos[i].sequencia, true);
    assert.equal(eventos[i].fim, false);
  }
  assert.equal(eventos[10].presente.quantidade, 10);
  assert.equal(eventos[10].fim, true);
});
