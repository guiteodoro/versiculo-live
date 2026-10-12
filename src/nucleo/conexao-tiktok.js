// Liga numa live do TikTok, repassa os eventos no formato padrão e cuida de
// tentar de novo quando não há live ou a conexão cai.
import { TikTokLiveConnection, WebcastEvent, ControlEvent, UserOfflineError } from 'tiktok-live-connector';
import { limparArroba, deChat, deGift, deFollow, deLike, espectadoresDe } from './adaptador.js';

const ESPERAS_QUEDA_MS = [5_000, 10_000, 20_000, 30_000]; // depois, sempre o último
const ESPERA_SEM_LIVE_MS = 30_000;

function clientePadrao(arroba) {
  return new TikTokLiveConnection(arroba, { enableExtendedGiftInfo: true, processInitialData: false });
}

// aoErro(texto, erro): linha em português com o contexto + o erro original, para o log.
export function criarConexao({ criarCliente = clientePadrao, aoEvento, aoEstado, aoErro = () => {} }) {
  let geracao = 0;
  let arroba = '';
  let cliente = null;
  let timer = null;
  let tentativasQueda = 0;
  let emReconexao = false; // true desde uma queda até a próxima conexão bem-sucedida

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
      emReconexao = true;
      aoEstado({ estado: 'reconectando', arroba });
      agendar(minhaGeracao, proximaEsperaQueda());
    });

    // Erros depois de conectado (ex.: mensagem que não decodificou) só vão para o log;
    // se a conexão cair de fato, chega 'disconnected'.
    atual.on(ControlEvent.ERROR, (dado) => {
      if (!valida()) return;
      const contexto = dado?.info ? ` (${dado.info})` : '';
      aoErro(`Erro na conexão com a live de @${arroba}${contexto}`, dado?.exception ?? dado);
    });

    Promise.resolve()
      .then(() => atual.connect())
      .then(
        () => {
          if (!valida()) return;
          noAr = true;
          tentativasQueda = 0;
          emReconexao = false;
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
            aoErro(`Falha ao conectar na live de @${arroba}`, erro);
            if (emReconexao) {
              aoEstado({ estado: 'reconectando', arroba, mensagem: `Conexão perdida com a live de @${arroba}. Tentando de novo…` });
            } else {
              aoEstado({ estado: 'erro', arroba, mensagem: `Não consegui conectar na live de @${arroba}. Tentando de novo…` });
            }
            agendar(minhaGeracao, proximaEsperaQueda());
          }
        },
      );
  }

  function conectar(bruto) {
    encerrarAtual();
    tentativasQueda = 0;
    emReconexao = false;
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
