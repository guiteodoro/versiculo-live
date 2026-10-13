// src/logs.js
// Log em arquivo, um por dia (AAAA-MM-DD.log), mantidos 7 dias.
// Escrita síncrona de propósito: o log precisa sobreviver a um erro fatal logo em seguida.
import fs from 'node:fs';
import path from 'node:path';

const DIAS_MANTIDOS = 7;
const NOME_LOG = /^(\d{4})-(\d{2})-(\d{2})\.log$/;

const p2 = (n) => String(n).padStart(2, '0');

function nomeDoDia(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}.log`;
}

function hora(d) {
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

function apagarAntigos(pasta, hoje) {
  const limite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - DIAS_MANTIDOS).getTime();
  for (const arquivo of fs.readdirSync(pasta)) {
    const m = arquivo.match(NOME_LOG);
    if (!m) continue;
    const dia = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
    if (dia < limite) {
      try { fs.unlinkSync(path.join(pasta, arquivo)); } catch { /* segue sem apagar */ }
    }
  }
}

function detalhe(e) {
  if (e === undefined || e === null) return '';
  if (e instanceof Error) return e.stack || `${e.name}: ${e.message}`;
  if (typeof e === 'object') {
    try { return JSON.stringify(e); } catch { return String(e); }
  }
  return String(e);
}

export function criarLog(pasta, { agora = Date.now } = {}) {
  fs.mkdirSync(pasta, { recursive: true });
  try { apagarAntigos(pasta, new Date(agora())); } catch { /* limpeza não é essencial */ }

  function escrever(nivel, texto) {
    const d = new Date(agora());
    try {
      fs.appendFileSync(path.join(pasta, nomeDoDia(d)), `[${hora(d)}] ${nivel} ${texto}\n`, 'utf8');
    } catch {
      // sem disco para o log: não há onde avisar, e o app não deve cair por isso
    }
  }

  return {
    info(texto) {
      escrever('INFO', texto);
    },
    erro(texto, e) {
      const extra = detalhe(e);
      escrever('ERRO', extra ? `${texto}: ${extra}` : texto);
    },
  };
}
