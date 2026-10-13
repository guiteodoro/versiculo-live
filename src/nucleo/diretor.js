// src/nucleo/diretor.js
// Decide o que aparece na tela 9:16 e quando: cartões, faixas de seguidor,
// barra de curtidas e linhas de registro para a janela de controle.
import { criarFila } from './fila.js';
import { criarCurtidas } from './curtidas.js';
import { cortar } from './texto.js';

const MAX_FAIXAS_PENDENTES = 3;
const MAX_AGRADECIDOS = 5;
const INTERVALO_CONVITE_MS = 2 * 60 * 1000;
const ANONIMO = { arroba: 'anônimo', nome: 'anônimo', foto: null };

export function criarDiretor({ versiculos, filtro, config, mostrar, agora = Date.now }) {
  let cfg = { ...config };
  let fila;
  let curtidas;
  let ultimoTamanho = 0;
  let metaPendente = null; // valor da meta batida que ainda não apareceu
  let atual = null; // { tipo, item, timer }
  let faixaTimer = null;
  let conviteTimer = null;
  let convitePendente = false;
  let faixasPendentes = [];
  const seguidoresVistos = new Set();
  let agradecidos = []; // mural: quem teve o cartão dourado, mais recente primeiro
  let parado = false;

  const ms = (s) => s * 1000;

  function novoEstado() {
    fila = criarFila({ esperaMs: cfg.esperaMin * 60000, agora });
    curtidas = criarCurtidas({ meta: cfg.metaCurtidas });
    ultimoTamanho = 0;
  }
  novoEstado();

  function copiaUsuario(usuario) {
    return { ...usuario, arroba: cortar(usuario.arroba ?? usuario.nome ?? '', 22) };
  }

  function bloqueado(usuario) {
    return filtro.bloqueia(usuario.arroba ?? '') || filtro.bloqueia(usuario.nome ?? '');
  }

  function registro(texto) {
    mostrar({ canal: 'registro', texto });
  }

  function avisarFila() {
    const tamanho = fila.tamanho();
    if (tamanho === ultimoTamanho) return;
    ultimoTamanho = tamanho;
    mostrar({ canal: 'fila', tamanho });
  }

  function avisarCurtidas() {
    const { total, meta } = curtidas.estado();
    mostrar({ canal: 'curtidas', total, meta, passo: cfg.metaCurtidas });
  }

  function agradecer(usuario) {
    if (usuario.arroba === ANONIMO.arroba) return;
    agradecidos = [usuario.arroba, ...agradecidos.filter((a) => a !== usuario.arroba)].slice(0, MAX_AGRADECIDOS);
    mostrar({ canal: 'agradecidos', arrobas: [...agradecidos] });
  }

  // ---- convite "como receber um versículo", a cada 2 minutos ----

  function agendarConvite() {
    clearTimeout(conviteTimer);
    conviteTimer = setTimeout(() => {
      conviteTimer = null;
      convitePendente = true;
      mostrarProximo();
    }, INTERVALO_CONVITE_MS);
  }

  // ---- cartão central ----

  function exibir(tipo, item, duracaoMs, mensagem) {
    atual = {
      tipo,
      item,
      timer: setTimeout(() => {
        atual = null;
        mostrarProximo();
      }, duracaoMs),
    };
    mostrar({ canal: 'cartao', tipo, ...mensagem, duracaoMs });
  }

  // `pularMeta`: presente que interrompe comentário entra já; a meta vem logo depois dele.
  function mostrarProximo({ pularMeta = false } = {}) {
    if (parado || atual) return;

    if (metaPendente !== null && !pularMeta) {
      const meta = metaPendente;
      metaPendente = null;
      const versiculo = versiculos.doTema('comunidade');
      exibir('meta', null, ms(cfg.tempoMetaS), { versiculo, meta });
      registro(`❤ meta de ${meta} curtidas!`);
      return;
    }

    // convite: depois da meta e dos presentes, antes dos comentários
    if (convitePendente && !fila.temPresente()) {
      convitePendente = false;
      exibir('convite', null, ms(cfg.tempoComentarioS), {});
      registro('📣 convite');
      agendarConvite();
      return;
    }

    const item = fila.proximo();
    if (!item) return;
    avisarFila();
    const aSeguir = fila.aSeguir(3);

    if (item.tipo === 'presente') {
      const versiculo = versiculos.doTema('gratidao');
      exibir('presente', item, ms(cfg.tempoPresenteS), {
        usuario: item.usuario,
        versiculo,
        presente: item.presente,
        aSeguir,
      });
      agradecer(item.usuario);
      registro(`🎁 @${item.usuario.arroba} · ${item.presente.quantidade} ${item.presente.nome} → ${versiculo.ref}`);
      return;
    }

    const primeiraVez = !item.versiculo;
    if (primeiraVez) item.versiculo = versiculos.escolher(item.texto);
    exibir('comentario', item, ms(cfg.tempoComentarioS), {
      usuario: item.usuario,
      versiculo: item.versiculo,
      aSeguir,
    });
    if (primeiraVez) {
      registro(`💬 @${item.usuario.arroba}: "${cortar(item.texto, 60)}" → ${item.versiculo.ref}`);
    }
  }

  // ---- faixas de seguidor ----

  function exibirFaixa(usuario) {
    faixaTimer = setTimeout(() => {
      faixaTimer = null;
      const proxima = faixasPendentes.shift();
      if (proxima) exibirFaixa(proxima);
    }, ms(cfg.tempoSeguidorS));
    mostrar({
      canal: 'faixa',
      usuario,
      versiculo: versiculos.doTema('boas-vindas'),
      duracaoMs: ms(cfg.tempoSeguidorS),
    });
  }

  // ---- eventos ----

  function receberComentario(evento) {
    const texto = typeof evento.texto === 'string' ? evento.texto.trim() : '';
    if (texto === '') return;
    const usuario = copiaUsuario(evento.usuario);
    if (bloqueado(evento.usuario) || filtro.bloqueia(texto)) {
      registro(`🚫 comentário bloqueado de @${usuario.arroba}`);
      return;
    }
    if (!fila.adicionarComentario({ tipo: 'comentario', usuario, texto })) return;
    avisarFila();
    mostrarProximo();
  }

  function receberPresente(evento) {
    const usuario = bloqueado(evento.usuario)
      ? { ...evento.usuario, ...ANONIMO }
      : copiaUsuario(evento.usuario);
    fila.adicionarPresente({ tipo: 'presente', usuario, presente: { ...evento.presente } });
    const interrompeu = atual?.tipo === 'comentario';
    if (interrompeu) {
      clearTimeout(atual.timer);
      fila.devolverComentario(atual.item);
      atual = null;
    }
    mostrarProximo({ pularMeta: interrompeu });
    avisarFila();
  }

  function receberSeguiu(evento) {
    const usuario = copiaUsuario(evento.usuario);
    if (bloqueado(evento.usuario)) {
      registro(`🚫 seguida bloqueada de @${usuario.arroba}`);
      return;
    }
    if (seguidoresVistos.has(usuario.id)) return;
    if (faixaTimer && faixasPendentes.length >= MAX_FAIXAS_PENDENTES) return;
    seguidoresVistos.add(usuario.id);
    registro(`➕ @${usuario.arroba} seguiu`);
    if (faixaTimer) faixasPendentes.push(usuario);
    else exibirFaixa(usuario);
  }

  function receberCurtidas(evento) {
    const metaAntes = curtidas.estado().meta;
    const { total, meta, bateuMeta } = curtidas.somar(evento.quantidade);
    mostrar({ canal: 'curtidas', total, meta, passo: cfg.metaCurtidas });
    if (bateuMeta) {
      metaPendente = metaAntes;
      mostrarProximo();
    }
  }

  function receber(evento) {
    if (parado || !evento) return;
    switch (evento.tipo) {
      case 'comentario': return receberComentario(evento);
      case 'presente': return receberPresente(evento);
      case 'seguiu': return receberSeguiu(evento);
      case 'curtidas': return receberCurtidas(evento);
    }
  }

  function limparTimers() {
    if (atual) clearTimeout(atual.timer);
    if (faixaTimer) clearTimeout(faixaTimer);
    clearTimeout(conviteTimer);
    atual = null;
    faixaTimer = null;
    conviteTimer = null;
  }

  function atualizarConfig(novaConfig) {
    cfg = { ...novaConfig };
    fila.definirEspera(cfg.esperaMin * 60000);
    curtidas.definirMeta(cfg.metaCurtidas);
    avisarCurtidas();
  }

  function reiniciar() {
    limparTimers();
    novoEstado();
    seguidoresVistos.clear();
    metaPendente = null;
    convitePendente = false;
    agendarConvite();
    faixasPendentes = [];
    agradecidos = [];
    avisarCurtidas();
    mostrar({ canal: 'fila', tamanho: 0 });
    mostrar({ canal: 'agradecidos', arrobas: [] });
  }

  function parar() {
    limparTimers();
    parado = true;
  }

  agendarConvite();

  return { receber, atualizarConfig, reiniciar, parar };
}
