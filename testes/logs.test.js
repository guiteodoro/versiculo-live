import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { criarLog } from '../src/logs.js';

async function comTemp(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vl-logs-'));
  try { await fn(dir); } finally { await fs.rm(dir, { recursive: true, force: true }); }
}

const DIA = 24 * 60 * 60 * 1000;
// 12/10/2026 14:05:09, hora local
const AGORA = new Date(2026, 9, 12, 14, 5, 9).getTime();

function nomeDoDia(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.log`;
}

test('grava linha com hora no arquivo do dia', async () => {
  await comTemp(async (dir) => {
    const log = criarLog(dir, { agora: () => AGORA });
    log.info('app iniciado');
    log.erro('falhou algo', new Error('detalhe do erro'));
    const conteudo = await fs.readFile(path.join(dir, '2026-10-12.log'), 'utf8');
    const linhas = conteudo.trim().split(/\r?\n/);
    assert.match(linhas[0], /^\[14:05:09\] INFO app iniciado$/);
    assert.match(linhas[1], /^\[14:05:09\] ERRO falhou algo: /);
    assert.match(conteudo, /detalhe do erro/);
  });
});

test('erro sem objeto de erro grava só o texto', async () => {
  await comTemp(async (dir) => {
    const log = criarLog(dir, { agora: () => AGORA });
    log.erro('só texto');
    const conteudo = await fs.readFile(path.join(dir, '2026-10-12.log'), 'utf8');
    assert.equal(conteudo.trim(), '[14:05:09] ERRO só texto');
  });
});

test('cria a pasta se não existir', async () => {
  await comTemp(async (dir) => {
    const pasta = path.join(dir, 'logs');
    criarLog(pasta, { agora: () => AGORA }).info('oi');
    const arquivos = await fs.readdir(pasta);
    assert.deepEqual(arquivos, ['2026-10-12.log']);
  });
});

test('na criação apaga log de 8 dias atrás e mantém o de 6', async () => {
  await comTemp(async (dir) => {
    const velho = nomeDoDia(AGORA - 8 * DIA);
    const recente = nomeDoDia(AGORA - 6 * DIA);
    await fs.writeFile(path.join(dir, velho), 'antigo\n');
    await fs.writeFile(path.join(dir, recente), 'recente\n');
    await fs.writeFile(path.join(dir, 'outro.txt'), 'não é log\n');
    criarLog(dir, { agora: () => AGORA });
    const arquivos = (await fs.readdir(dir)).sort();
    assert.deepEqual(arquivos, [recente, 'outro.txt'].sort());
  });
});
