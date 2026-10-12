import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { UserOfflineError } from 'tiktok-live-connector';
import { criarConexao } from '../src/nucleo/conexao-tiktok.js';

const amostra = (nome) =>
  JSON.parse(readFileSync(new URL(`./amostras/${nome}.json`, import.meta.url), 'utf8'));

class ClienteFalso extends EventEmitter {
  constructor(arroba, resultado) {
    super();
    this.arroba = arroba;
    this.resultado = resultado; // 'ok' ou um Error para rejeitar
    this.desconectado = false;
  }
  connect() {
    return this.resultado === 'ok' ? Promise.resolve({}) : Promise.reject(this.resultado);
  }
  disconnect() {
    this.desconectado = true;
    return Promise.resolve();
  }
}

// resultados: lista de resultados de connect(), em ordem; quando acaba, repete o último.
function preparar(t, resultados = ['ok']) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const clientes = [];
  const eventos = [];
  const estados = [];
  const erros = [];
  const conexao = criarConexao({
    criarCliente: (arroba) => {
      const resultado = resultados[Math.min(clientes.length, resultados.length - 1)];
      const cliente = new ClienteFalso(arroba, resultado);
      clientes.push(cliente);
      return cliente;
    },
    aoEvento: (e) => eventos.push(e),
    aoEstado: (e) => estados.push(e),
    aoErro: (texto, erro) => erros.push({ texto, erro }),
  });
  return { conexao, clientes, eventos, estados, erros };
}

const esvaziar = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

async function avancar(t, ms) {
  t.mock.timers.tick(ms);
  await esvaziar();
}

const nomesDosEstados = (estados) => estados.map((e) => e.estado);
const ultimo = (lista) => lista[lista.length - 1];

test('conecta e repassa eventos', async (t) => {
  const { conexao, clientes, eventos, estados, erros } = preparar(t);
  conexao.conectar('@Dono.Live');
  assert.equal(clientes.length, 1);
  assert.equal(clientes[0].arroba, 'dono.live');
  assert.deepEqual(estados[0], { estado: 'conectando', arroba: 'dono.live' });
  await esvaziar();
  assert.deepEqual(ultimo(estados), { estado: 'no_ar', arroba: 'dono.live', espectadores: null });

  const c = clientes[0];
  c.emit('chat', amostra('chat'));
  c.emit('gift', amostra('gift-sequencia'));
  c.emit('follow', amostra('follow'));
  c.emit('like', amostra('like'));
  c.emit('chat', { content: 'sem user' });
  assert.deepEqual(eventos.map((e) => e.tipo), ['comentario', 'presente-bruto', 'seguiu', 'curtidas']);
  assert.equal(eventos[0].texto, 'Deus é fiel, amém');
  assert.equal(eventos[0].usuario.arroba, 'usuario_teste');

  c.emit('roomUser', { total: '57' });
  assert.deepEqual(ultimo(estados), { estado: 'no_ar', arroba: 'dono.live', espectadores: 57 });
  const quantos = estados.length;
  c.emit('roomUser', { total: '57' });
  assert.equal(estados.length, quantos, 'mesmo número de espectadores não reemite');
  c.emit('roomUser', { viewerCount: 60 });
  assert.equal(ultimo(estados).espectadores, 60);

  const excecao = new Error('x');
  c.emit('error', { info: 'falha qualquer', exception: excecao });
  assert.equal(ultimo(estados).estado, 'no_ar', 'erro em execução não muda o estado');
  assert.equal(erros.length, 1);
  assert.equal(erros[0].erro, excecao);
  assert.equal(erros[0].texto, 'Erro na conexão com a live de @dono.live (falha qualquer)');

  await conexao.desconectar();
  assert.equal(c.desconectado, true);
  assert.deepEqual(ultimo(estados), { estado: 'desligado', arroba: 'dono.live' });
  c.emit('chat', amostra('chat'));
  assert.equal(eventos.length, 4, 'depois de desconectar nada passa');
  await avancar(t, 120_000);
  assert.equal(clientes.length, 1, 'desconectar não reconecta');
});

test('offline: sem_live e tenta de novo em 30 s', async (t) => {
  const offline = new UserOfflineError('offline');
  const { conexao, clientes, estados, erros } = preparar(t, [offline, offline, 'ok']);
  conexao.conectar('fulano');
  await esvaziar();
  assert.deepEqual(ultimo(estados), {
    estado: 'sem_live',
    arroba: 'fulano',
    mensagem: 'Não encontrei live ativa em @fulano',
  });
  assert.equal(erros.length, 0, 'sem live não é erro de log');
  await avancar(t, 29_999);
  assert.equal(clientes.length, 1);
  await avancar(t, 1);
  assert.equal(clientes.length, 2);
  assert.equal(ultimo(estados).estado, 'sem_live');
  await avancar(t, 30_000);
  assert.equal(clientes.length, 3);
  assert.equal(ultimo(estados).estado, 'no_ar');
  await avancar(t, 120_000);
  assert.equal(clientes.length, 3);
  await conexao.desconectar();
});

test('queda: reconecta em 5, 10, 20, 30, 30 s', async (t) => {
  const falha = new Error('rede caiu');
  const { conexao, clientes, estados, erros } = preparar(t, ['ok', falha]);
  conexao.conectar('fulano');
  await esvaziar();
  assert.equal(ultimo(estados).estado, 'no_ar');

  clientes[0].emit('disconnected', { code: 1006, reason: '' });
  assert.deepEqual(ultimo(estados), { estado: 'reconectando', arroba: 'fulano' });

  for (const [i, espera] of [5_000, 10_000, 20_000, 30_000, 30_000].entries()) {
    await avancar(t, espera - 1);
    assert.equal(clientes.length, i + 1, `antes de ${espera} ms`);
    await avancar(t, 1);
    assert.equal(clientes.length, i + 2, `depois de ${espera} ms`);
    assert.deepEqual(ultimo(estados), {
      estado: 'reconectando',
      arroba: 'fulano',
      mensagem: 'Conexão perdida com a live de @fulano. Tentando de novo…',
    });
  }
  assert.equal(erros.length, 5);
  assert.equal(erros[0].erro, falha);
  assert.equal(erros[0].texto, 'Falha ao conectar na live de @fulano');
  await conexao.desconectar();
});

test('primeira conexão com erro desconhecido: erro em português e tenta em 5, 10 s', async (t) => {
  const falha = new Error('Unexpected server response: 500');
  const { conexao, clientes, estados, erros } = preparar(t, [falha]);
  conexao.conectar('fulano');
  await esvaziar();
  assert.deepEqual(ultimo(estados), {
    estado: 'erro',
    arroba: 'fulano',
    mensagem: 'Não consegui conectar na live de @fulano. Tentando de novo…',
  });
  assert.deepEqual(erros, [{ texto: 'Falha ao conectar na live de @fulano', erro: falha }]);
  await avancar(t, 4_999);
  assert.equal(clientes.length, 1);
  await avancar(t, 1);
  assert.equal(clientes.length, 2);
  assert.equal(ultimo(estados).estado, 'erro', 'sem queda antes, continua erro');
  await avancar(t, 10_000);
  assert.equal(clientes.length, 3);
  await conexao.desconectar();
});

test('conexão que volta zera a espera crescente', async (t) => {
  const falha = new Error('rede caiu');
  const { conexao, clientes, estados } = preparar(t, ['ok', falha, 'ok']);
  conexao.conectar('fulano');
  await esvaziar();
  clientes[0].emit('disconnected', {});
  await avancar(t, 5_000); // falha
  await avancar(t, 10_000); // volta
  assert.equal(clientes.length, 3);
  assert.equal(ultimo(estados).estado, 'no_ar');
  clientes[2].emit('disconnected', {});
  await avancar(t, 5_000);
  assert.equal(clientes.length, 4, 'voltou a tentar em 5 s');
  await conexao.desconectar();
});

test('streamEnd: terminou e não reconecta', async (t) => {
  const { conexao, clientes, estados } = preparar(t);
  conexao.conectar('fulano');
  await esvaziar();
  clientes[0].emit('streamEnd', { action: 3 });
  clientes[0].emit('disconnected', {}); // a biblioteca desconecta logo depois
  assert.deepEqual(ultimo(estados), { estado: 'terminou', arroba: 'fulano', mensagem: 'A live terminou' });
  await avancar(t, 300_000);
  assert.equal(clientes.length, 1);
  assert.equal(ultimo(estados).estado, 'terminou');
});

test('streamEnd suspenso: trata como queda e reconecta em 5 s', async (t) => {
  const { conexao, clientes, estados } = preparar(t);
  conexao.conectar('fulano');
  await esvaziar();
  clientes[0].emit('streamEnd', { action: 4 }); // CONTROL_ACTION_STREAM_SUSPENDED
  clientes[0].emit('disconnected', {}); // a biblioteca desconecta logo depois
  assert.deepEqual(ultimo(estados), { estado: 'reconectando', arroba: 'fulano' });
  assert.equal(nomesDosEstados(estados).filter((e) => e === 'reconectando').length, 1);
  await avancar(t, 4_999);
  assert.equal(clientes.length, 1);
  await avancar(t, 1);
  assert.equal(clientes.length, 2);
  assert.equal(ultimo(estados).estado, 'no_ar');
  await conexao.desconectar();
});

test('streamEnd com ação desconhecida: também reconecta', async (t) => {
  const { conexao, clientes, estados } = preparar(t);
  conexao.conectar('fulano');
  await esvaziar();
  clientes[0].emit('streamEnd', {});
  assert.deepEqual(ultimo(estados), { estado: 'reconectando', arroba: 'fulano' });
  await avancar(t, 5_000);
  assert.equal(clientes.length, 2);
  await conexao.desconectar();
});

test('trocar de @ descarta eventos da conexão antiga', async (t) => {
  const { conexao, clientes, eventos, estados } = preparar(t);
  conexao.conectar('antigo');
  await esvaziar();
  conexao.conectar('novo');
  assert.equal(clientes[0].desconectado, true);
  await esvaziar();
  assert.deepEqual(ultimo(estados), { estado: 'no_ar', arroba: 'novo', espectadores: null });

  const quantos = estados.length;
  clientes[0].emit('chat', amostra('chat'));
  clientes[0].emit('roomUser', { total: '99' });
  clientes[0].emit('disconnected', {});
  clientes[0].emit('streamEnd', {});
  assert.equal(eventos.length, 0);
  assert.equal(estados.length, quantos);
  await avancar(t, 60_000);
  assert.equal(clientes.length, 2, 'queda da antiga não reconecta');

  clientes[1].emit('chat', amostra('chat'));
  assert.equal(eventos.length, 1);
  await conexao.desconectar();
});

test('trocar de @ durante a espera cancela a tentativa antiga', async (t) => {
  const offline = new UserOfflineError('offline');
  const { conexao, clientes, estados } = preparar(t, [offline, 'ok']);
  conexao.conectar('antigo');
  await esvaziar();
  assert.equal(ultimo(estados).estado, 'sem_live');
  conexao.conectar('novo');
  await esvaziar();
  await avancar(t, 60_000);
  assert.deepEqual(clientes.map((c) => c.arroba), ['antigo', 'novo']);
  await conexao.desconectar();
});

test('comentário do dono é ignorado', async (t) => {
  const { conexao, clientes, eventos } = preparar(t);
  conexao.conectar('@Usuario_Teste');
  await esvaziar();
  clientes[0].emit('chat', amostra('chat')); // displayId "usuario_teste"
  assert.equal(eventos.length, 0);
  clientes[0].emit('gift', amostra('gift-fim'));
  assert.equal(eventos.length, 1, 'só comentários do dono são descartados');
  await conexao.desconectar();
});

test('@ inválido: erro sem criar cliente', async (t) => {
  const { conexao, clientes, estados } = preparar(t);
  conexao.conectar('nome com espaço');
  assert.equal(clientes.length, 0);
  assert.deepEqual(estados, [{ estado: 'erro', arroba: '', mensagem: 'Digite um @ válido do TikTok.' }]);
  await avancar(t, 120_000);
  assert.equal(clientes.length, 0);
});
