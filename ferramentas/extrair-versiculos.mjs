// ferramentas/extrair-versiculos.mjs
// Gera dados/versiculos.json copiando os textos EXATOS da Bíblia Livre (BLIVRE) em USFM.
// Uso: node ferramentas/extrair-versiculos.mjs <pasta-usfm> [selecao.json] [saida.json]
// A pasta USFM vem de https://eBible.org/Scriptures/porbr2018_usfm.zip (não versionar).
import fs from 'node:fs/promises';
import path from 'node:path';

const LIVROS = {
  'Gênesis': 'GEN', 'Êxodo': 'EXO', 'Levítico': 'LEV', 'Números': 'NUM', 'Deuteronômio': 'DEU',
  'Josué': 'JOS', 'Juízes': 'JDG', 'Rute': 'RUT', '1 Samuel': '1SA', '2 Samuel': '2SA',
  '1 Reis': '1KI', '2 Reis': '2KI', '1 Crônicas': '1CH', '2 Crônicas': '2CH', 'Esdras': 'EZR',
  'Neemias': 'NEH', 'Ester': 'EST', 'Jó': 'JOB', 'Salmos': 'PSA', 'Provérbios': 'PRO',
  'Eclesiastes': 'ECC', 'Cânticos': 'SNG', 'Isaías': 'ISA', 'Jeremias': 'JER', 'Lamentações': 'LAM',
  'Ezequiel': 'EZK', 'Daniel': 'DAN', 'Oseias': 'HOS', 'Joel': 'JOL', 'Amós': 'AMO', 'Obadias': 'OBA',
  'Jonas': 'JON', 'Miqueias': 'MIC', 'Naum': 'NAM', 'Habacuque': 'HAB', 'Sofonias': 'ZEP',
  'Ageu': 'HAG', 'Zacarias': 'ZEC', 'Malaquias': 'MAL', 'Mateus': 'MAT', 'Marcos': 'MRK',
  'Lucas': 'LUK', 'João': 'JHN', 'Atos': 'ACT', 'Romanos': 'ROM', '1 Coríntios': '1CO',
  '2 Coríntios': '2CO', 'Gálatas': 'GAL', 'Efésios': 'EPH', 'Filipenses': 'PHP', 'Colossenses': 'COL',
  '1 Tessalonicenses': '1TH', '2 Tessalonicenses': '2TH', '1 Timóteo': '1TI', '2 Timóteo': '2TI',
  'Tito': 'TIT', 'Filemom': 'PHM', 'Hebreus': 'HEB', 'Tiago': 'JAS', '1 Pedro': '1PE', '2 Pedro': '2PE',
  '1 João': '1JN', '2 João': '2JN', '3 João': '3JN', 'Judas': 'JUD', 'Apocalipse': 'REV',
};
const MAX_TEXTO = 280;

// Limpa uma linha de versículo: tira notas (\f…\f*), referências cruzadas (\x…\x*, \rq…\rq*)
// e marcadores de caractere (\add, \w …), mantendo o texto e a pontuação.
function limpar(s) {
  return s
    .replace(/\\f\s.*?\\f\*/g, ' ')
    .replace(/\\x\s.*?\\x\*/g, ' ')
    .replace(/\\rq\s.*?\\rq\*/g, ' ')
    .replace(/\\\+?w\s([^|\\]*)(\|[^\\]*)?\\\+?w\*/g, '$1')
    .replace(/\\\+?[a-z]+\d*\*?/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

// Lê um livro USFM: Map "cap:vers" → texto limpo.
function lerLivro(conteudo) {
  const versos = new Map();
  let cap = 0;
  for (const linha of conteudo.replace(/^﻿/, '').split(/\r?\n/)) {
    const c = linha.match(/^\\c\s+(\d+)/);
    if (c) { cap = Number(c[1]); continue; }
    const v = linha.match(/^\\v\s+(\d+)\s(.*)$/);
    if (v) versos.set(`${cap}:${v[1]}`, limpar(v[2]));
  }
  return versos;
}

async function carregarBiblia(pasta) {
  const biblia = new Map();
  for (const nome of await fs.readdir(pasta)) {
    if (!nome.endsWith('.usfm')) continue;
    const conteudo = await fs.readFile(path.join(pasta, nome), 'utf8');
    const id = conteudo.replace(/^﻿/, '').match(/^\\id\s+(\S+)/)[1];
    biblia.set(id, lerLivro(conteudo));
  }
  return biblia;
}

// "Salmos 23:1-2" → texto dos versículos 1 e 2 juntos.
function textoDe(biblia, ref) {
  const m = ref.match(/^(.+) (\d+):(\d+)(?:-(\d+))?$/);
  if (!m) throw new Error(`Referência inválida: ${ref}`);
  const [, livro, cap, ini, fim = ini] = m;
  const codigo = LIVROS[livro];
  if (!codigo) throw new Error(`Livro desconhecido: ${livro} (${ref})`);
  const versos = biblia.get(codigo);
  const partes = [];
  for (let v = Number(ini); v <= Number(fim); v++) {
    const t = versos?.get(`${cap}:${v}`);
    if (!t) throw new Error(`Versículo não encontrado: ${livro} ${cap}:${v}`);
    partes.push(t);
  }
  return partes.join(' ');
}

async function principal() {
  const [pasta, selecao = 'ferramentas/selecao-versiculos.json', saida = 'dados/versiculos.json'] = process.argv.slice(2);
  if (!pasta) throw new Error('Informe a pasta com os arquivos USFM da Bíblia Livre.');
  const biblia = await carregarBiblia(pasta);
  const sel = JSON.parse(await fs.readFile(selecao, 'utf8'));
  const vistos = new Set();
  const temas = sel.temas.map((t) => ({
    id: t.id,
    palavras: t.palavras,
    versiculos: t.refs.map((ref) => {
      if (vistos.has(ref)) throw new Error(`Referência repetida: ${ref}`);
      vistos.add(ref);
      const texto = textoDe(biblia, ref);
      const limite = t.maxTexto ?? MAX_TEXTO;
      if (Array.from(texto).length > limite) {
        throw new Error(`${ref} tem ${Array.from(texto).length} caracteres (máx. ${limite}): ${texto}`);
      }
      return { ref, texto };
    }),
  }));
  const json = { traducao: sel.traducao, atribuicao: sel.atribuicao, temas };
  await fs.writeFile(saida, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`${saida}: ${temas.length} temas, ${vistos.size} versículos.`);
}

principal().catch((e) => { console.error(e.message); process.exit(1); });
