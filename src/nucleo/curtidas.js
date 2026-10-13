// Contador de curtidas com meta que avança.
// Módulo puro: sem timers nem efeitos colaterais além do próprio estado.

// Menor múltiplo de `passo` estritamente maior que `total`.
function proximaMeta(total, passo) {
  return (Math.floor(total / passo) + 1) * passo;
}

export function criarCurtidas({ meta }) {
  let total = 0;
  let passo = meta;
  let proxima = meta;

  function somar(n) {
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) {
      total += n;
    }
    const bateuMeta = total >= proxima;
    if (bateuMeta) proxima = proximaMeta(total, passo);
    return { total, meta: proxima, bateuMeta };
  }

  function definirMeta(novoPasso) {
    passo = novoPasso;
    proxima = proximaMeta(total, passo);
  }

  function estado() {
    return { total, meta: proxima };
  }

  return { somar, definirMeta, estado };
}
