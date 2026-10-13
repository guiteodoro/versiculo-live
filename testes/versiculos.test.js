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
test('plural não é erro de digitação: só conta se estiver na lista', () => {
  const v = criarVersiculos({ temas: [
    { id: 'familia', palavras: ['irmao'], versiculos: [{ ref: 'A 1:1', texto: 'a' }] },
    { id: 'geral', palavras: [], versiculos: [{ ref: 'B 1:1', texto: 'b' }] },
    { id: 'boas-vindas', palavras: [], versiculos: [{ ref: 'C 1:1', texto: 'c' }] },
    { id: 'comunidade', palavras: [], versiculos: [{ ref: 'D 1:1', texto: 'd' }] },
  ] });
  assert.equal(v.temaDe('meu irmão'), 'familia');
  assert.equal(v.temaDe('meu irnao'), 'familia');
  assert.equal(v.temaDe('boa noite irmãos'), 'geral');
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

// ---- dados/versiculos.json (Bíblia Livre) ----
import { readFileSync } from 'node:fs';
const DADOS = JSON.parse(readFileSync(new URL('../dados/versiculos.json', import.meta.url), 'utf8'));
const BUSCAVEIS = ['ansiedade', 'medo', 'cura', 'familia', 'tristeza', 'gratidao', 'fe', 'perdao', 'provisao', 'forca', 'paz', 'salvacao'];

test('dados/versiculos.json: válido, com os 15 temas na ordem e a tradução BLIVRE', () => {
  assert.deepEqual(validarDados(DADOS), { ok: true });
  assert.deepEqual(DADOS.temas.map((t) => t.id), [...BUSCAVEIS, 'geral', 'boas-vindas', 'comunidade']);
  assert.match(DADOS.traducao, /BLIVRE/);
  assert.match(DADOS.atribuicao, /Diego Santos/);
});
test('dados/versiculos.json: quantidades por tema', () => {
  const porId = Object.fromEntries(DADOS.temas.map((t) => [t.id, t]));
  for (const id of BUSCAVEIS) {
    const t = porId[id];
    assert.ok(t.versiculos.length >= 10 && t.versiculos.length <= 15, `${id}: ${t.versiculos.length} versículos`);
    assert.ok(t.palavras.length >= 8 && t.palavras.length <= 25, `${id}: ${t.palavras.length} palavras`);
  }
  assert.ok(porId.geral.versiculos.length >= 30);
  assert.ok(porId['boas-vindas'].versiculos.length >= 10);
  assert.ok(porId.comunidade.versiculos.length >= 10);
});
test('dados/versiculos.json: refs únicas e textos curtos', () => {
  const todos = DADOS.temas.flatMap((t) => t.versiculos);
  const refs = todos.map((v) => v.ref);
  assert.equal(new Set(refs).size, refs.length);
  for (const v of todos) assert.ok(Array.from(v.texto).length <= 280, `${v.ref} passa de 280`);
  for (const v of DADOS.temas.find((t) => t.id === 'boas-vindas').versiculos) {
    assert.ok(Array.from(v.texto).length <= 120, `${v.ref} (boas-vindas) passa de 120`);
  }
});
test('dados/versiculos.json: comentários vão para o tema certo', () => {
  const v = criarVersiculos(DADOS);
  const casos = {
    'estou com muita ansiedade': 'ansiedade',
    'sou grato a Deus': 'gratidao',
    'orem pela saúde da minha mãe': 'cura',
    'tenho medo do futuro': 'medo',
    'orem pelos meus filhos': 'familia',
    'estou muito triste': 'tristeza',
    'perdi o emprego': 'provisao',
    'Deus me perdoa': 'perdao',
    'boa noite': 'geral',
    'boa noite irmãos': 'geral',
    'amém': 'geral',
    'oi': 'geral',
    'salve galera': 'geral',
    'Deus abençoe': 'geral',
    'por favor': 'geral',
    'tenho um pedido de oração': 'geral',
    'tô perdida aqui na live': 'geral',
    'curta a live galera': 'geral',
    'curta e compartilhe': 'geral',
    'lutou muito': 'geral',
    'preciso de cura': 'cura',
    'que deus cure minha avó': 'cura',
    'estou com muita dor': 'cura',
    'ore pela minha mãe': 'familia',
    'meu irmão está preso': 'familia',
    'orem pelo meu pai': 'familia',
    'chorei muito hoje': 'tristeza',
    'graças a Deus': 'gratidao',
  };
  for (const [texto, tema] of Object.entries(casos)) assert.equal(v.temaDe(texto), tema, texto);
});
