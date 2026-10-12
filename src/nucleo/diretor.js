// src/nucleo/diretor.js
// Decide o que aparece na tela 9:16 e quando: cartões, faixas de seguidor,
// barra de curtidas e linhas de registro para a janela de controle.
import { criarFila } from './fila.js';
import { criarCurtidas } from './curtidas.js';
import { cortar } from './texto.js';

const MAX_FAIXAS_PENDENTES = 3;
const ANONIMO = { arroba: 'anônimo', nome: 'anônimo', foto: null };

export function criarDiretor({ versiculos, filtro, config, mostrar, agora = Date.now }) {
  let cfg = { ...config };
  let fila;
  let curtidas;
  let ultimoTamanho = 0;
  let metaPendente = null; // valor da meta batida que ainda não apareceu
  let atual = null; // { tipo, item, timer }
  let faixaTimer = null;
  let faixasPendentes = [];
  const seguidoresVistos = new Set();
  let parado = false;

  const ms = (s) => s * 1000;

  function novoEstado() {
    fila = criarFila({ esperaMs: cfg.esperaMin * 60000, agora });
    curtidas = criarCurtidas({ meta: cfg.metaCurtidas });
    ultimoTamanho = 0;
  }
  novoEstado();

  function copiaUsuario(usuario) {
    return { ...usuario, arroba: cortar(usuario.arroba, 22) };
  }

  function bloqueado(usuario) {
    return filtro.bloqueia(usuario.arroba ?? '') || filtro.bloqueia(usuario.nome ?? '');
  }

  function ehDono(usuario) {
    const dono = (cfg.arroba ?? '').trim().replace(/^@/, '').toLowerCase();
    return dono !== '' && (usuario.arroba ?? '').toLowerCase() === dono;
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
    mostrar({ canal: 'curtidas', total, meta });
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

  function mostrarProximo() {
    if (parado || atual) return;

    if (metaPendente !== null) {
      const meta = metaPendente;
      metaPendente = null;
      const versiculo = versiculos.doTema('comunidade');
      exibir('meta', null, ms(cfg.tempoMetaS), { versiculo, meta });
      registro(`❤ meta de ${meta} curtidas!`);
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
    if (texto === '' || ehDono(evento.usuario)) return;
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
    if (atual?.tipo === 'comentario') {
      clearTimeout(atual.timer);
      fila.devolverComentario(atual.item);
      atual = null;
    }
    mostrarProximo();
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
    mostrar({ canal: 'curtidas', total, meta });
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
    atual = null;
    faixaTimer = null;
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
    faixasPendentes = [];
    avisarCurtidas();
    mostrar({ canal: 'fila', tamanho: 0 });
  }

  function parar() {
    limparTimers();
    parado = true;
  }

  return { receber, atualizarConfig, reiniciar, parar };
}
