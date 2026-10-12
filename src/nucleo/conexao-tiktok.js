// Liga numa live do TikTok, repassa os eventos no formato padrão e cuida de
// tentar de novo quando não há live ou a conexão cai.
import { TikTokLiveConnection, WebcastEvent, ControlEvent, UserOfflineError } from 'tiktok-live-connector';
import { limparArroba, deChat, deGift, deFollow, deLike, espectadoresDe } from './adaptador.js';

const ESPERAS_QUEDA_MS = [5_000, 10_000, 20_000, 30_000]; // depois, sempre o último
const ESPERA_SEM_LIVE_MS = 30_000;

function clientePadrao(arroba) {
  return new TikTokLiveConnection(arroba, { enableExtendedGiftInfo: true, processInitialData: false });
}

export function criarConexao({ criarCliente = clientePadrao, aoEvento, aoEstado }) {
  let geracao = 0;
  let arroba = '';
  let cliente = null;
  let timer = null;
  let tentativasQueda = 0;

  function encerrarAtual() {
    geracao++;
    clearTimeout(timer);
    timer = null;
    const antigo = cliente;
    cliente = null;
    if (!antigo) return Promise.resolve();
    antigo.removeAllListeners?.();
    antigo.on?.('error', () => {}); // erros tardios do cliente antigo não derrubam o app
    try {
      return Promise.resolve(antigo.disconnect()).catch(() => {});
    } catch {
      return Promise.resolve();
    }
  }

  function agendar(minhaGeracao, esperaMs) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (minhaGeracao === geracao) tentar(minhaGeracao);
    }, esperaMs);
  }

  function proximaEsperaQueda() {
    const espera = ESPERAS_QUEDA_MS[Math.min(tentativasQueda, ESPERAS_QUEDA_MS.length - 1)];
    tentativasQueda++;
    return espera;
  }

  function tentar(minhaGeracao) {
    const atual = criarCliente(arroba);
    cliente = atual;
    let noAr = false;
    let espectadores = null;
    const valida = () => minhaGeracao === geracao && cliente === atual;

    const repassar = (converter, filtrar) => (dado) => {
      if (!valida()) return;
      const evento = converter(dado);
      if (evento && (!filtrar || filtrar(evento))) aoEvento(evento);
    };
    const naoEhDoDono = (evento) => (evento.usuario.arroba ?? '').toLowerCase() !== arroba;

    atual.on(WebcastEvent.CHAT, repassar(deChat, naoEhDoDono));
    atual.on(WebcastEvent.GIFT, repassar(deGift));
    atual.on(WebcastEvent.FOLLOW, repassar(deFollow));
    atual.on(WebcastEvent.LIKE, repassar(deLike));

    atual.on(WebcastEvent.ROOM_USER, (dado) => {
      if (!valida() || !noAr) return;
      const novo = espectadoresDe(dado);
      if (novo === null || novo === espectadores) return;
      espectadores = novo;
      aoEstado({ estado: 'no_ar', arroba, espectadores });
    });

    atual.on(WebcastEvent.STREAM_END, () => {
      if (!valida()) return;
      encerrarAtual(); // a live acabou: nada mais desta geração conta
      aoEstado({ estado: 'terminou', arroba, mensagem: 'A live terminou' });
    });

    atual.on(ControlEvent.DISCONNECTED, () => {
      if (!valida() || !noAr) return;
      noAr = false;
      aoEstado({ estado: 'reconectando', arroba });
      agendar(minhaGeracao, proximaEsperaQueda());
    });

    // Erros depois de conectado (ex.: mensagem que não decodificou) não mudam o estado;
    // se a conexão cair de fato, chega 'disconnected'.
    atual.on(ControlEvent.ERROR, () => {});

    Promise.resolve()
      .then(() => atual.connect())
      .then(
        () => {
          if (!valida()) return;
          noAr = true;
          tentativasQueda = 0;
          aoEstado({ estado: 'no_ar', arroba, espectadores });
        },
        (erro) => {
          if (!valida()) return;
          cliente = null;
          atual.removeAllListeners();
          atual.on('error', () => {});
          if (erro instanceof UserOfflineError) {
            aoEstado({ estado: 'sem_live', arroba, mensagem: `Não encontrei live ativa em @${arroba}` });
            agendar(minhaGeracao, ESPERA_SEM_LIVE_MS);
          } else {
            aoEstado({ estado: 'erro', arroba, mensagem: erro?.message || String(erro) });
            agendar(minhaGeracao, proximaEsperaQueda());
          }
        },
      );
  }

  function conectar(bruto) {
    encerrarAtual();
    tentativasQueda = 0;
    arroba = limparArroba(bruto);
    if (!arroba) {
      aoEstado({ estado: 'erro', arroba: '', mensagem: 'Digite um @ válido do TikTok.' });
      return;
    }
    aoEstado({ estado: 'conectando', arroba });
    tentar(geracao);
  }

  async function desconectar() {
    await encerrarAtual();
    aoEstado({ estado: 'desligado', arroba });
  }

  return { conectar, desconectar };
}
