// src/main.js
// Processo principal: janelas, IPC e a ligação entre as peças do núcleo.
//   conexão / simulador → presentes brutos em combos → diretor; demais eventos direto no diretor.
//   diretor.mostrar → cartao/faixa/curtidas para a tela; registro/fila para o controle.
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { criarLog } from './logs.js';
import { lerConfig, salvarConfig } from './nucleo/config.js';
import { validarDados, criarVersiculos } from './nucleo/versiculos.js';
import { EXEMPLO } from './nucleo/versiculos-exemplo.js';
import { criarFiltro } from './nucleo/filtro.js';
import { criarCombos } from './nucleo/combos.js';
import { criarDiretor } from './nucleo/diretor.js';
import { criarConexao } from './nucleo/conexao-tiktok.js';
import { limparArroba } from './nucleo/adaptador.js';
import { criarSimulador } from './nucleo/simulador.js';

const PASTA_SRC = path.dirname(fileURLToPath(import.meta.url));
const PASTA_DADOS_PROJETO = path.join(PASTA_SRC, '..', 'dados');
const ARQUIVOS_DADOS = ['versiculos.json', 'bloqueadas.txt'];
const MAX_REGISTROS = 50;
const AJUSTES = ['esperaMin', 'tempoComentarioS', 'tempoPresenteS', 'metaCurtidas'];
const TESTES = ['comentario', 'presente', 'seguidor', 'curtidas'];

// Modo de verificação sem tela: `npx electron . --autoteste [--arroba=nome]`.
const AUTOTESTE = process.argv.includes('--autoteste');
const ARROBA_AUTOTESTE = process.argv.find((a) => a.startsWith('--arroba='))?.slice('--arroba='.length);

const pastaUsuario = app.getPath('userData');
const pastaDados = path.join(pastaUsuario, 'dados');
const pastaLogs = path.join(pastaUsuario, 'logs');
const caminhoConfig = path.join(pastaUsuario, 'config.json');

const log = criarLog(pastaLogs);

let controle = null;
let tela = null;
let config = null;
let diretor = null;
let combos = null;
let conexao = null;
let simulador = null;
let ativo = false; // o usuário pediu para conectar e ainda não desconectou
let estadoAtual = { estado: 'desligado', arroba: '', ativo: false };
let tamanhoFila = 0;
let avisoAtual = '';
const registros = [];

const p2 = (n) => String(n).padStart(2, '0');
function horaAgora() {
  const d = new Date();
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

// Nada vindo de timer ou callback de evento pode derrubar o processo principal.
function seguro(contexto, fn) {
  try {
    return fn();
  } catch (e) {
    log.erro(contexto, e);
    return undefined;
  }
}

function enviar(janela, canal, dado) {
  if (janela && !janela.isDestroyed()) janela.webContents.send(canal, dado);
}

// ---- estado, registros e avisos para o controle ----

function enviarEstado(estado) {
  estadoAtual = { ...estado, ativo };
  log.info(`estado: ${estado.estado}${estado.arroba ? ` @${estado.arroba}` : ''}` +
    `${estado.espectadores != null ? ` · ${estado.espectadores} espectadores` : ''}` +
    `${estado.mensagem ? ` · ${estado.mensagem}` : ''}` +
    `${ativo ? ' [ativo]' : ''}`);
  enviar(controle, 'vl:aoEstado', estadoAtual);
}

function aoEstadoConexao(estado) {
  // @ inválido e live terminada não tentam de novo; desligado é fim.
  if (['desligado', 'terminou'].includes(estado.estado) || (estado.estado === 'erro' && !estado.arroba)) ativo = false;
  enviarEstado(estado);
}

function avisar(texto) {
  avisoAtual = texto;
  if (texto) log.info(`aviso: ${texto}`);
  enviar(controle, 'vl:aoAviso', texto);
}

function mostrar(msg) {
  switch (msg.canal) {
    case 'cartao':
    case 'faixa':
    case 'curtidas':
      enviar(tela, 'vl:aoMostrar', msg);
      break;
    case 'registro': {
      const registro = { hora: horaAgora(), texto: msg.texto };
      registros.push(registro);
      if (registros.length > MAX_REGISTROS) registros.shift();
      if (AUTOTESTE) log.info(`registro: ${msg.texto}`);
      enviar(controle, 'vl:aoRegistro', registro);
      break;
    }
    case 'fila':
      tamanhoFila = msg.tamanho;
      enviar(controle, 'vl:aoFila', tamanhoFila);
      break;
  }
}

// ---- dados do usuário ----

async function prepararDados() {
  await fs.mkdir(pastaDados, { recursive: true });
  for (const nome of ARQUIVOS_DADOS) {
    try {
      await fs.copyFile(path.join(PASTA_DADOS_PROJETO, nome), path.join(pastaDados, nome), fs.constants.COPYFILE_EXCL);
      log.info(`copiado ${nome} para ${pastaDados}`);
    } catch (e) {
      if (e.code !== 'EEXIST') log.erro(`Não consegui copiar ${nome} para a pasta de dados`, e);
    }
  }
}

async function carregarVersiculos() {
  const caminho = path.join(pastaDados, 'versiculos.json');
  let erro;
  try {
    const dados = JSON.parse(await fs.readFile(caminho, 'utf8'));
    const validacao = validarDados(dados);
    if (validacao.ok) {
      avisar('');
      return criarVersiculos(dados);
    }
    erro = validacao.erro;
  } catch (e) {
    log.erro('Falha ao ler versiculos.json', e);
    erro = e.code === 'ENOENT'
      ? 'O arquivo versiculos.json não foi encontrado na pasta de dados.'
      : 'O arquivo versiculos.json não pôde ser lido (JSON inválido).';
  }
  avisar(`Problema em versiculos.json: ${erro} Usando os versículos de exemplo.`);
  return criarVersiculos(EXEMPLO);
}

async function carregarFiltro() {
  try {
    return criarFiltro(await fs.readFile(path.join(pastaDados, 'bloqueadas.txt'), 'utf8'));
  } catch (e) {
    log.erro('Falha ao ler bloqueadas.txt; seguindo sem palavras bloqueadas', e);
    return criarFiltro('');
  }
}

// Monta (ou remonta, ao conectar) combos + diretor com os dados atuais da pasta.
async function montarNucleo() {
  const versiculos = await carregarVersiculos();
  const filtro = await carregarFiltro();
  seguro('Erro ao parar o diretor anterior', () => diretor?.parar());
  seguro('Erro ao parar os combos anteriores', () => combos?.parar());
  diretor = criarDiretor({ versiculos, filtro, config, mostrar });
  combos = criarCombos({
    emitir: (evento) => seguro('Erro no diretor ao receber presente', () => diretor.receber(evento)),
  });
}

function rotear(evento) {
  seguro(`Erro ao tratar evento ${evento?.tipo}`, () => {
    if (evento.tipo === 'presente-bruto') combos.receber(evento);
    else diretor.receber(evento);
  });
}

// ---- janelas ----

const webPreferences = {
  preload: path.join(PASTA_SRC, 'preload.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
};

function travarNavegacao(janela) {
  janela.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  janela.webContents.on('will-navigate', (e) => e.preventDefault());
}

function criarControle() {
  controle = new BrowserWindow({
    width: 760,
    height: 620,
    minWidth: 600,
    minHeight: 480,
    title: 'Versículo Live',
    backgroundColor: '#14161c',
    autoHideMenuBar: true,
    webPreferences,
  });
  travarNavegacao(controle);
  controle.webContents.on('did-finish-load', () => {
    // a janela pode ter (re)carregado depois dos eventos: manda o que ela precisa
    enviar(controle, 'vl:aoEstado', estadoAtual);
    enviar(controle, 'vl:aoFila', tamanhoFila);
    enviar(controle, 'vl:aoAviso', avisoAtual);
    for (const registro of registros) enviar(controle, 'vl:aoRegistro', registro);
  });
  controle.on('closed', () => {
    controle = null;
    app.quit();
  });
  controle.loadFile(path.join(PASTA_SRC, 'controle', 'index.html'));
}

function abrirTela() {
  if (tela && !tela.isDestroyed()) {
    tela.show();
    tela.focus();
    return;
  }
  tela = new BrowserWindow({
    width: 540,
    height: 960,
    title: 'Versículo Live — Tela',
    backgroundColor: '#0b1026',
    autoHideMenuBar: true,
    webPreferences,
  });
  tela.setAspectRatio(9 / 16);
  travarNavegacao(tela);
  tela.on('page-title-updated', (e) => e.preventDefault());
  tela.on('closed', () => {
    tela = null;
  });
  tela.loadFile(path.join(PASTA_SRC, 'tela', 'index.html'));
}

// ---- IPC ----

function responder(canal, fn) {
  ipcMain.handle(canal, async (_evento, ...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      log.erro(`Erro ao atender ${canal}`, e);
      return undefined;
    }
  });
}

async function conectar(bruto) {
  const arroba = limparArroba(bruto);
  if (arroba) {
    config = await salvarConfig(caminhoConfig, { arroba });
    await montarNucleo(); // relê versiculos.json e bloqueadas.txt
    seguro('Erro ao reiniciar o diretor', () => diretor.reiniciar());
    ativo = true;
  }
  conexao.conectar(bruto); // @ inválido: a conexão responde com a mensagem de erro
  return arroba ? config : null;
}

async function desconectar() {
  ativo = false;
  await conexao.desconectar();
}

function registrarIpc() {
  responder('vl:conectar', conectar);
  responder('vl:desconectar', desconectar);
  responder('vl:config.ler', () => config);
  responder('vl:config.salvar', async (mudancas) => {
    const permitidas = {};
    for (const campo of AJUSTES) {
      if (mudancas && campo in mudancas) permitidas[campo] = mudancas[campo];
    }
    config = await salvarConfig(caminhoConfig, permitidas);
    seguro('Erro ao atualizar a config do diretor', () => diretor.atualizarConfig(config));
    return config;
  });
  responder('vl:testar', (tipo) => {
    if (!TESTES.includes(tipo)) return;
    seguro(`Erro no teste ${tipo}`, () => (tipo === 'curtidas' ? simulador.curtidas(500) : simulador[tipo]()));
  });
  responder('vl:abrirPastaDados', () => abrirPasta(pastaDados));
  responder('vl:abrirLogs', () => abrirPasta(pastaLogs));
  responder('vl:abrirTela', abrirTela);
}

async function abrirPasta(pasta) {
  const erro = await shell.openPath(pasta);
  if (erro) log.erro(`Não consegui abrir a pasta ${pasta}: ${erro}`);
}

// ---- erros não tratados ----

function erroNaoTratado(tipo, e) {
  log.erro(`Erro não tratado (${tipo})`, e);
  enviarEstado({
    estado: 'erro',
    arroba: estadoAtual.arroba,
    mensagem: 'Aconteceu um erro inesperado. Os detalhes estão no log.',
  });
}

process.on('uncaughtException', (e) => erroNaoTratado('uncaughtException', e));
process.on('unhandledRejection', (e) => erroNaoTratado('unhandledRejection', e));

// ---- autoteste ----

function autoteste() {
  log.info('autoteste: início');
  const passos = [
    [1000, () => simulador.comentario()],
    [1500, () => simulador.presente()],
    [3000, () => conectar('@@@')],
  ];
  if (ARROBA_AUTOTESTE) passos.push([5000, () => conectar(ARROBA_AUTOTESTE)]);
  // fim de live simulado (a conexão real emite isto e para de tentar): o botão deve voltar a Conectar
  passos.push([9000, async () => {
    await desconectar();
    ativo = true;
    aoEstadoConexao({ estado: 'terminou', arroba: ARROBA_AUTOTESTE ?? '', mensagem: 'A live terminou' });
  }]);
  // o que a janela de controle mostra, para conferir pelo log
  const conferir = async () => {
    if (!controle) return;
    const visto = await controle.webContents.executeJavaScript(`({
      status: document.getElementById('texto-status').textContent,
      botao: document.getElementById('botao-conectar').textContent,
      eventos: document.querySelectorAll('#lista-eventos li').length,
    })`);
    log.info(`autoteste: controle ${JSON.stringify(visto)}`);
  };
  for (const ms of [2500, 4000, 8000, 15000]) setTimeout(() => conferir().catch((e) => log.erro('autoteste', e)), ms);
  controle?.webContents.on('console-message', (e) => log.info(`autoteste: console ${e.level}: ${e.message}`));
  for (const [ms, passo] of passos) setTimeout(() => seguro('autoteste', passo), ms);
  setTimeout(() => {
    log.info('autoteste: fim');
    app.quit();
  }, 20_000);
}

// ---- início ----

async function iniciar() {
  log.info(`Versículo Live iniciado (Electron ${process.versions.electron})`);
  config = await lerConfig(caminhoConfig);
  await prepararDados();
  await montarNucleo();
  conexao = criarConexao({
    aoEvento: rotear,
    aoEstado: (estado) => seguro('Erro ao repassar estado', () => aoEstadoConexao(estado)),
    aoErro: (texto, erro) => log.erro(texto, erro),
  });
  simulador = criarSimulador({ aoEvento: rotear });
  registrarIpc();
  criarControle();
  abrirTela();
  if (AUTOTESTE) autoteste();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!controle) return;
    if (controle.isMinimized()) controle.restore();
    controle.focus();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    seguro('Erro ao parar o diretor', () => diretor?.parar());
    seguro('Erro ao parar os combos', () => combos?.parar());
    if (conexao) conexao.desconectar().catch((e) => log.erro('Erro ao desconectar', e));
  });
  app.whenReady().then(iniciar).catch((e) => {
    log.erro('Falha ao iniciar o app', e);
    app.quit();
  });
}
