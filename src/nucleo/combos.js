// Agrupa o fluxo de eventos de um combo de presentes em um único evento final.
export function criarCombos({ emitir, limiteMs = 5000 }) {
  const pendentes = new Map(); // chave -> { bruto, timer }

  function emitirPresente(bruto) {
    emitir({ tipo: 'presente', usuario: bruto.usuario, presente: bruto.presente });
  }

  function esquecer(chave) {
    const pendente = pendentes.get(chave);
    if (pendente) clearTimeout(pendente.timer);
    pendentes.delete(chave);
  }

  function receber(bruto) {
    if (!bruto.sequencia) {
      emitirPresente(bruto);
      return;
    }
    const chave = bruto.usuario.id + '|' + bruto.presente.nome;
    esquecer(chave);
    if (bruto.fim) {
      emitirPresente(bruto);
      return;
    }
    const timer = setTimeout(() => {
      pendentes.delete(chave);
      emitirPresente(bruto);
    }, limiteMs);
    pendentes.set(chave, { bruto, timer });
  }

  function parar() {
    for (const { timer } of pendentes.values()) clearTimeout(timer);
    pendentes.clear();
  }

  return { receber, parar };
}
