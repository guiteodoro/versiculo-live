// Fila de cartões da tela: presentes primeiro, depois comentários.
// Módulo puro: sem timers; o tempo vem só de `agora`.

export function criarFila({ esperaMs, maxComentarios = 20, agora = Date.now }) {
  let espera = esperaMs;
  const presentes = [];
  const comentarios = [];
  const entradaPorPessoa = new Map(); // usuario.id -> instante em que entrou na fila

  function adicionarComentario(evento) {
    const id = evento.usuario.id;
    const t = agora();
    const ultima = entradaPorPessoa.get(id);
    if (ultima !== undefined && t - ultima < espera) return false;
    if (comentarios.length >= maxComentarios) comentarios.shift();
    comentarios.push(evento);
    entradaPorPessoa.set(id, t);
    return true;
  }

  function adicionarPresente(evento) {
    presentes.push(evento);
  }

  function proximo() {
    if (presentes.length > 0) return presentes.shift();
    if (comentarios.length > 0) return comentarios.shift();
    return null;
  }

  function devolverComentario(evento) {
    comentarios.unshift(evento);
  }

  function aSeguir(n) {
    const fila = [...presentes, ...comentarios];
    const arrobas = fila.slice(0, Math.max(0, n)).map((e) => e.usuario.arroba);
    return { arrobas, resto: Math.max(0, fila.length - arrobas.length) };
  }

  function definirEspera(ms) {
    espera = ms;
  }

  function tamanho() {
    return presentes.length + comentarios.length;
  }

  return { adicionarComentario, adicionarPresente, proximo, devolverComentario, aSeguir, definirEspera, tamanho };
}
