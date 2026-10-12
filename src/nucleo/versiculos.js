// src/nucleo/versiculos.js
// Escolha de versículo por tema, sem repetir os últimos sorteados.
import { normalizar, palavras, distancia } from './texto.js';

const OBRIGATORIOS = ['geral', 'boas-vindas', 'comunidade'];
const SEM_BUSCA = new Set(OBRIGATORIOS);

const ehTexto = (x) => typeof x === 'string';

export function validarDados(json) {
  if (json === null || typeof json !== 'object') {
    return { ok: false, erro: 'O arquivo de versículos está vazio ou não é um objeto.' };
  }
  if (!Array.isArray(json.temas) || json.temas.length === 0) {
    return { ok: false, erro: 'O campo "temas" precisa ser uma lista com pelo menos um tema.' };
  }
  for (const [i, t] of json.temas.entries()) {
    if (t === null || typeof t !== 'object' || !ehTexto(t.id) || t.id === '') {
      return { ok: false, erro: `O tema nº ${i + 1} não tem "id" válido.` };
    }
    if (!Array.isArray(t.palavras) || !t.palavras.every(ehTexto)) {
      return { ok: false, erro: `O tema "${t.id}" precisa de "palavras" como lista de textos.` };
    }
    if (!Array.isArray(t.versiculos) || t.versiculos.length === 0) {
      return { ok: false, erro: `O tema "${t.id}" não tem versículos.` };
    }
    for (const [j, v] of t.versiculos.entries()) {
      if (v === null || typeof v !== 'object' || !ehTexto(v.ref) || !ehTexto(v.texto)) {
        return { ok: false, erro: `O versículo nº ${j + 1} do tema "${t.id}" precisa de "ref" e "texto".` };
      }
    }
  }
  for (const id of OBRIGATORIOS) {
    if (!json.temas.some((t) => t.id === id)) {
      return { ok: false, erro: `Falta o tema obrigatório "${id}".` };
    }
  }
  return { ok: true };
}

export function criarVersiculos(dados, { aleatorio = Math.random, evitar = 10 } = {}) {
  const temas = dados.temas;
  const porId = new Map(temas.map((t) => [t.id, t]));
  const buscaveis = temas
    .filter((t) => !SEM_BUSCA.has(t.id))
    .map((t) => ({ id: t.id, chaves: t.palavras.map(normalizar).filter((p) => p !== '') }));
  const historico = []; // refs, do mais antigo para o mais recente

  function acerta(palavra, chave) {
    return palavra === chave || (palavra.length >= 5 && distancia(palavra, chave) <= 1);
  }

  function temaDe(texto) {
    const ws = palavras(texto);
    let melhor = 'geral';
    let max = 0;
    for (const t of buscaveis) {
      let n = 0;
      for (const w of ws) for (const c of t.chaves) if (acerta(w, c)) n++;
      if (n > max) { max = n; melhor = t.id; }
    }
    return melhor;
  }

  function sortear(lista) {
    const i = Math.min(Math.floor(aleatorio() * lista.length), lista.length - 1);
    return lista[i];
  }

  function doTema(id) {
    const tema = porId.get(id) ?? porId.get('geral');
    const livres = tema.versiculos.filter((v) => !historico.includes(v.ref));
    let escolhido;
    if (livres.length > 0) {
      escolhido = sortear(livres);
    } else {
      // todos no histórico: o mais antigo nele
      const idx = (v) => historico.indexOf(v.ref);
      const menor = Math.min(...tema.versiculos.map(idx));
      escolhido = tema.versiculos.find((v) => idx(v) === menor);
    }
    const antigo = historico.indexOf(escolhido.ref);
    if (antigo !== -1) historico.splice(antigo, 1);
    historico.push(escolhido.ref);
    while (historico.length > evitar) historico.shift();
    return { ref: escolhido.ref, texto: escolhido.texto, tema: tema.id };
  }

  return { temaDe, doTema, escolher: (texto) => doTema(temaDe(texto)) };
}
