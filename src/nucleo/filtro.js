// src/nucleo/filtro.js
// Filtro de palavras bloqueadas: compara por palavra/expressão inteira, normalizada.

import { normalizar } from './texto.js';

// `conteudoDoArquivo`: uma entrada por linha. Linhas vazias e iniciadas por `#` são ignoradas.
export function criarFiltro(conteudoDoArquivo) {
  const entradas = conteudoDoArquivo
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter((linha) => linha !== '' && !linha.startsWith('#'))
    .map(normalizar)
    .filter((entrada) => entrada !== '');

  return {
    bloqueia(texto) {
      const alvo = ` ${normalizar(texto)} `;
      return entradas.some((entrada) => alvo.includes(` ${entrada} `));
    },
  };
}
