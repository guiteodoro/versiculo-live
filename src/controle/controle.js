// src/controle/controle.js
// Janela de controle: conectar, status, ajustes, testes e lista de eventos.
const MAX_EVENTOS = 50;
const AJUSTES = ['esperaMin', 'tempoComentarioS', 'tempoPresenteS', 'metaCurtidas'];
const CORES = {
  no_ar: 'verde',
  conectando: 'amarelo',
  reconectando: 'amarelo',
  sem_live: 'amarelo',
  desligado: 'cinza',
  terminou: 'cinza',
  erro: 'vermelho',
};

const $ = (id) => document.getElementById(id);

let estado = { estado: 'desligado', arroba: '', ativo: false };
let fila = 0;

// desligado, live terminada ou erro que não tenta de novo → Conectar; qualquer outro → Desconectar
function podeConectar() {
  return estado.estado === 'desligado' || estado.estado === 'terminou' || (estado.estado === 'erro' && !estado.ativo);
}

function textoStatus() {
  switch (estado.estado) {
    case 'desligado': return 'Desconectado';
    case 'conectando': return 'Conectando…';
    case 'no_ar': {
      const partes = ['No ar'];
      if (estado.espectadores != null) partes.push(`${estado.espectadores} espectadores`);
      partes.push(`fila: ${fila}`);
      return partes.join(' · ');
    }
    case 'reconectando': return estado.mensagem || 'Reconectando…';
    default: return estado.mensagem || '';
  }
}

function desenharStatus() {
  $('bolinha').className = `bolinha ${CORES[estado.estado] ?? 'cinza'}`;
  $('texto-status').textContent = textoStatus();
  $('botao-conectar').textContent = podeConectar() ? 'Conectar' : 'Desconectar';
}

function preencherAjustes(config) {
  if (!config) return;
  for (const campo of AJUSTES) $(campo).value = config[campo];
}

function adicionarEvento({ hora, texto }) {
  const li = document.createElement('li');
  const span = document.createElement('span');
  span.className = 'hora';
  span.textContent = hora;
  li.append(span, document.createTextNode(texto));
  const lista = $('lista-eventos');
  lista.prepend(li);
  while (lista.children.length > MAX_EVENTOS) lista.lastElementChild.remove();
}

window.vl.aoEstado((novo) => {
  estado = novo;
  desenharStatus();
});

window.vl.aoFila((tamanho) => {
  fila = tamanho;
  desenharStatus();
});

window.vl.aoRegistro(adicionarEvento);

window.vl.aoAviso((texto) => {
  $('aviso').textContent = texto || '';
  $('aviso').hidden = !texto;
});

$('form-conexao').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (podeConectar()) {
    const config = await window.vl.conectar($('arroba').value);
    if (config?.arroba) $('arroba').value = config.arroba;
  } else {
    await window.vl.desconectar();
  }
});

for (const campo of AJUSTES) {
  $(campo).addEventListener('change', async () => {
    const bruto = $(campo).value.trim();
    const valor = Number(bruto);
    // Campo vazio ou que não é número: ignora e volta ao valor atual.
    const config = bruto === '' || !Number.isFinite(valor)
      ? await window.vl.config.ler()
      : await window.vl.config.salvar({ [campo]: valor });
    preencherAjustes(config);
  });
}

for (const botao of document.querySelectorAll('[data-teste]')) {
  botao.addEventListener('click', () => window.vl.testar(botao.dataset.teste));
}

$('abrir-dados').addEventListener('click', () => window.vl.abrirPastaDados());
$('abrir-logs').addEventListener('click', () => window.vl.abrirLogs());
$('abrir-tela').addEventListener('click', () => window.vl.abrirTela());

window.vl.config.ler().then((config) => {
  preencherAjustes(config);
  if (config?.arroba) $('arroba').value = config.arroba;
});

desenharStatus();
