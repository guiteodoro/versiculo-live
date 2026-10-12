// src/nucleo/texto.js
// Utilitários de texto: normalização, separação em palavras, distância e corte.

// Minúsculas, sem acento, pontuação/símbolos/emoji viram espaço, espaços colapsados.
export function normalizar(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Palavras normalizadas, sem vazios.
export function palavras(s) {
  const n = normalizar(s);
  return n === '' ? [] : n.split(' ');
}

// Distância de Levenshtein (por code point).
export function distancia(a, b) {
  const x = Array.from(a);
  const y = Array.from(b);
  let anterior = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const atual = [i];
    for (let j = 1; j <= y.length; j++) {
      const custo = x[i - 1] === y[j - 1] ? 0 : 1;
      atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + custo);
    }
    anterior = atual;
  }
  return anterior[y.length];
}

// Corta em `max` caracteres (code points), com "…" no fim quando passa do limite.
export function cortar(s, max) {
  const chars = Array.from(s);
  if (chars.length <= max) return s;
  return chars.slice(0, max - 1).join('') + '…';
}
