// src/tela/tela.js
// Janela 9:16 capturada no TikTok LIVE Studio: desenha as mensagens do diretor
// (cartao / faixa / curtidas / agradecidos) e a legenda "como funciona".
// Nomes e textos vêm de desconhecidos: só textContent.
'use strict';

(() => {
  const SAIDA_MS = 300;
  const TROCA_MS = 150;
  const DURACAO_PADRAO_MS = 8000;
  const FONTE_MIN_PX = 14;
  const PASSO_FONTE_PX = 2;
  const ARROBA_MIN_PX = 11;
  const ARROBA_VH = 3.4;

  const palco = document.getElementById('palco');
  const faixas = document.getElementById('faixas');
  const barraCurtidas = document.getElementById('curtidas');
  const numerosCurtidas = document.getElementById('curtidas-numeros');
  const preenchidoCurtidas = document.getElementById('curtidas-preenchido');
  const mural = document.getElementById('agradecidos');
  const nomesMural = document.getElementById('agradecidos-nomes');
  const legenda = document.getElementById('legenda');
  const LEGENDA_MS = 8000;
  const LINHA_MIN_PX = 10;

  const numero = (n) => (Number(n) || 0).toLocaleString('pt-BR');

  function el(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = String(texto);
    return e;
  }

  // ---- peças do cartão ----

  function inicial(usuario) {
    const base = String(usuario?.nome || usuario?.arroba || '');
    const letra = base.match(/[\p{L}\p{N}]/u)?.[0] ?? Array.from(base.trim())[0] ?? '?';
    return letra.toLocaleUpperCase('pt-BR');
  }

  function avatar(usuario) {
    const circulo = () => el('div', 'avatar inicial', inicial(usuario));
    const foto = typeof usuario?.foto === 'string' ? usuario.foto : '';
    if (!foto) return circulo();
    const img = el('img', 'avatar');
    img.alt = '';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => img.replaceWith(circulo()), { once: true });
    img.src = foto;
    return img;
  }

  function linhaUsuario(usuario) {
    const linha = el('div', 'usuario');
    linha.append(avatar(usuario), el('span', 'arroba', `@${usuario?.arroba ?? ''}`));
    return linha;
  }

  function verso(versiculo) {
    return el('p', 'verso', `“${versiculo?.texto ?? ''}”`);
  }

  function referencia(versiculo) {
    return el('div', 'ref', versiculo?.ref ?? '');
  }

  function textoASeguir(aSeguir) {
    const arrobas = Array.isArray(aSeguir?.arrobas) ? aSeguir.arrobas : [];
    if (arrobas.length === 0) return '';
    const resto = Number(aSeguir.resto) || 0;
    return `a seguir: ${arrobas.map((a) => `@${a}`).join(' · ')}${resto > 0 ? ` · +${resto}` : ''}`;
  }

  // Versículo longo: diminui a fonte em passos até a caixa parar de transbordar.
  function ajustarFonte(caixa, p, baseVh) {
    let px = Math.max(FONTE_MIN_PX, Math.round((window.innerHeight * baseVh) / 100));
    p.style.fontSize = `${px}px`;
    while (caixa.scrollHeight > caixa.clientHeight + 1 && px > FONTE_MIN_PX) {
      px = Math.max(FONTE_MIN_PX, px - PASSO_FONTE_PX);
      p.style.fontSize = `${px}px`;
    }
  }

  // @ longo: diminui a fonte (1px por passo) até caber na linha; abaixo do mínimo, quebra.
  function ajustarArroba(span, baseVh) {
    if (!span) return;
    span.classList.remove('quebra');
    let px = Math.max(ARROBA_MIN_PX, Math.round((window.innerHeight * baseVh) / 100));
    span.style.fontSize = `${px}px`;
    while (span.scrollWidth > span.clientWidth && px > ARROBA_MIN_PX) {
      px -= 1;
      span.style.fontSize = `${px}px`;
    }
    if (span.scrollWidth > span.clientWidth) span.classList.add('quebra');
  }

  // ---- camada: um elemento por vez, com troca rápida e saída esmaecendo ----

  function criarCamada(container) {
    let atual = null; // { elemento, timer, aoSair }

    function sair(entrada, classe, ms) {
      clearTimeout(entrada.timer);
      if (atual === entrada) atual = null;
      entrada.aoSair?.();
      entrada.elemento.classList.add(classe);
      setTimeout(() => entrada.elemento.remove(), ms);
    }

    function mostrar(elemento, duracaoMs, { aoSair } = {}) {
      if (atual) sair(atual, 'trocando', TROCA_MS);
      const duracao = Number(duracaoMs) > 0 ? Number(duracaoMs) : DURACAO_PADRAO_MS;
      container.append(elemento);
      const entrada = { elemento, aoSair, timer: 0 };
      entrada.timer = setTimeout(() => sair(entrada, 'saindo', SAIDA_MS), Math.max(0, duracao - SAIDA_MS));
      atual = entrada;
    }

    return { mostrar, atual: () => atual?.elemento ?? null };
  }

  const camadaCartao = criarCamada(palco);
  const camadaFaixa = criarCamada(faixas);

  // ---- partículas de luz (canvas, sem bibliotecas; desenha só enquanto há luz) ----

  const luz = (() => {
    const canvas = document.getElementById('luz');
    const ctx = canvas.getContext('2d');
    const MAX = 40;
    const MAX_EMITINDO = { presente: 28, meta: 16 };
    let particulas = [];
    let modo = null;
    let dono = null;
    let quadro = 0;
    let ultimo = 0;
    let largura = 0;
    let altura = 0;

    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const sctx = sprite.getContext('2d');
    const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,240,1)');
    grad.addColorStop(0.25, 'rgba(255,225,150,.85)');
    grad.addColorStop(1, 'rgba(255,200,100,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 64, 64);

    function redimensionar() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      largura = window.innerWidth;
      altura = window.innerHeight;
      canvas.width = Math.round(largura * dpr);
      canvas.height = Math.round(altura * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const sortear = (a, b) => a + Math.random() * (b - a);

    function subindo() {
      return {
        x: sortear(0.08, 0.92) * largura,
        y: sortear(0.5, 0.8) * altura,
        vx: sortear(-0.01, 0.01) * altura,
        vy: -sortear(0.03, 0.08) * altura,
        atrito: 1,
        vida: 0,
        duracao: sortear(2, 4),
        tamanho: sortear(0.012, 0.03) * altura,
      };
    }

    function explodindo() {
      const angulo = Math.random() * Math.PI * 2;
      const vel = sortear(0.2, 0.5) * altura;
      return {
        x: 0.5 * largura,
        y: 0.4 * altura,
        vx: Math.cos(angulo) * vel,
        vy: Math.sin(angulo) * vel,
        atrito: 0.96,
        vida: 0,
        duracao: sortear(1.2, 2.2),
        tamanho: sortear(0.015, 0.035) * altura,
      };
    }

    function passo(t) {
      const dt = Math.min(0.05, (t - (ultimo || t)) / 1000);
      ultimo = t;
      if (modo && particulas.length < MAX_EMITINDO[modo] && Math.random() < 0.5) particulas.push(subindo());
      particulas = particulas.filter((p) => (p.vida += dt) < p.duracao);
      ctx.clearRect(0, 0, largura, altura);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particulas) {
        const a = Math.pow(p.atrito, dt * 60);
        p.vx *= a;
        p.vy *= a;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const f = p.vida / p.duracao;
        ctx.globalAlpha = Math.min(1, f * 6, (1 - f) * 2);
        ctx.drawImage(sprite, p.x - p.tamanho / 2, p.y - p.tamanho / 2, p.tamanho, p.tamanho);
      }
      ctx.globalAlpha = 1;
      if (modo || particulas.length > 0) {
        quadro = requestAnimationFrame(passo);
      } else {
        quadro = 0;
        ctx.clearRect(0, 0, largura, altura);
      }
    }

    function rodar() {
      if (quadro) return;
      ultimo = 0;
      quadro = requestAnimationFrame(passo);
    }

    function ligar(novoDono, novoModo) {
      dono = novoDono;
      modo = novoModo;
      if (novoModo === 'meta') {
        while (particulas.length < MAX) particulas.push(explodindo());
      }
      rodar();
    }

    function desligar(antigoDono) {
      if (dono !== antigoDono) return;
      dono = null;
      modo = null; // as que já estão no ar terminam sozinhas
    }

    redimensionar();
    return { ligar, desligar, redimensionar };
  })();

  // ---- cartões ----

  // 🌹 só para Rose/Rosa; nome vazio vira "presente"; sem espaço duplo.
  function textoSelo(presente) {
    const nome = String(presente?.nome ?? '').trim() || 'presente';
    const icone = /^(rose|rosa)$/i.test(nome) ? '🌹' : '🎁';
    const partes = [icone, presente?.quantidade, nome].filter((x) => x !== undefined && x !== null && x !== '');
    return `${partes.join(' ')} · obrigado!`;
  }

  function mostrarCartao(msg) {
    const unidade = el('div', 'unidade');
    let caixa;
    let p;
    let baseVh;

    if (msg.tipo === 'meta') {
      unidade.classList.add('meta');
      caixa = el('div', 'cheia');
      p = verso(msg.versiculo);
      baseVh = 4.5;
      caixa.append(
        el('div', 'selo', `❤ META DE ${numero(msg.meta)} CURTIDAS!`),
        p,
        referencia(msg.versiculo),
        el('div', 'comunidade', 'versículo da comunidade'),
      );
      unidade.append(el('div', 'explosao'), caixa);
    } else {
      const presente = msg.tipo === 'presente';
      caixa = el('div', presente ? 'cartao presente' : 'cartao');
      p = verso(msg.versiculo);
      baseVh = 3.65;
      if (presente) {
        caixa.append(el('div', 'selo', textoSelo(msg.presente)));
      }
      caixa.append(linhaUsuario(msg.usuario), p, referencia(msg.versiculo));
      unidade.append(caixa);
      const proximos = textoASeguir(msg.aSeguir);
      if (proximos) unidade.append(el('div', 'a-seguir', proximos));
    }

    const modoLuz = msg.tipo === 'meta' ? 'meta' : msg.tipo === 'presente' ? 'presente' : null;
    camadaCartao.mostrar(unidade, msg.duracaoMs, {
      aoSair: modoLuz ? () => luz.desligar(unidade) : undefined,
    });
    unidade.ajustar = () => {
      ajustarArroba(caixa.querySelector('.arroba'), ARROBA_VH); // antes: a altura da linha afeta o versículo
      ajustarFonte(caixa, p, baseVh);
    };
    unidade.ajustar();
    if (modoLuz) luz.ligar(unidade, modoLuz);
  }

  function mostrarFaixa(msg) {
    const faixa = el('div', 'faixa');
    const chegou = el('div', 'chegou');
    chegou.append('✨ ', el('b', null, `@${msg.usuario?.arroba ?? ''}`), ' chegou à família!');
    const p = verso(msg.versiculo);
    faixa.append(chegou, p);
    camadaFaixa.mostrar(faixa, msg.duracaoMs, {
      aoSair: () => {
        if (camadaFaixa.atual() === null) document.body.classList.remove('com-faixa');
      },
    });
    document.body.classList.add('com-faixa'); // depois: a faixa trocada acabou de tirar a classe
    faixa.ajustar = () => ajustarFonte(faixa, p, 3.1);
    faixa.ajustar();
  }

  // A barra recomeça a cada meta batida: enche da meta anterior até a próxima.
  let metaAnterior = 0;
  let inicioBarra = 0;

  function mostrarCurtidas(msg) {
    const total = Number(msg.total) || 0;
    const meta = Number(msg.meta) || 0;
    if (Number(msg.passo) > 0 && Number(msg.passo) !== passoMeta) {
      passoMeta = Number(msg.passo);
      if (fraseAtual === 3) {
        legenda.textContent = frasesLegenda()[3];
        ajustarLinha(legenda);
      }
    }
    if (meta !== metaAnterior) {
      inicioBarra = metaAnterior > 0 && total >= metaAnterior && metaAnterior < meta ? metaAnterior : 0;
      metaAnterior = meta;
    }
    const faixaMeta = meta - inicioBarra;
    const fracao = faixaMeta > 0 ? (total - inicioBarra) / faixaMeta : 0;
    numerosCurtidas.textContent = `${numero(total)} / ${numero(meta)}`;
    preenchidoCurtidas.style.width = `${Math.max(0, Math.min(100, fracao * 100))}%`;
    barraCurtidas.classList.remove('oculto');
  }

  // ---- mural "Agradecemos": quem teve o cartão dourado, mais recente primeiro ----

  // Linha única (mural, legenda): diminui a fonte até caber, em vez de cortar.
  function ajustarLinha(elemento) {
    let px = Math.round((window.innerHeight * 2.3) / 100);
    elemento.style.fontSize = `${px}px`;
    while (elemento.scrollWidth > elemento.clientWidth && px > LINHA_MIN_PX) {
      px -= 1;
      elemento.style.fontSize = `${px}px`;
    }
  }

  function mostrarAgradecidos(msg) {
    const arrobas = Array.isArray(msg.arrobas) ? msg.arrobas : [];
    nomesMural.textContent = arrobas.map((a) => `@${a}`).join(' · ');
    mural.classList.toggle('oculto', arrobas.length === 0);
    ajustarLinha(mural);
  }

  // ---- legenda "como funciona": explica, não pede ----

  let passoMeta = 1000;
  const frasesLegenda = () => [
    '💬 Cada comentário recebe um versículo',
    '✍️ Escreva como você está: ansiedade, família, cura…',
    '🎁 Presentes aparecem em destaque dourado',
    `❤ A cada ${numero(passoMeta)} curtidas, um versículo para todos`,
  ];
  let fraseAtual = 0;

  function trocarLegenda() {
    legenda.classList.add('trocando-texto');
    setTimeout(() => {
      const frases = frasesLegenda();
      fraseAtual = (fraseAtual + 1) % frases.length;
      legenda.textContent = frases[fraseAtual];
      ajustarLinha(legenda);
      legenda.classList.remove('trocando-texto');
    }, 600);
  }
  legenda.textContent = frasesLegenda()[0];
  ajustarLinha(legenda);
  setInterval(trocarLegenda, LEGENDA_MS);

  // ---- janela redimensionada: recalcula fontes e o canvas ----

  let ajusteAgendado = 0;
  window.addEventListener('resize', () => {
    if (ajusteAgendado) return;
    ajusteAgendado = requestAnimationFrame(() => {
      ajusteAgendado = 0;
      luz.redimensionar();
      camadaCartao.atual()?.ajustar?.();
      camadaFaixa.atual()?.ajustar?.();
      ajustarLinha(mural);
      ajustarLinha(legenda);
    });
  });

  // ---- mensagens do diretor ----

  function receber(msg) {
    try {
      switch (msg?.canal) {
        case 'cartao': return mostrarCartao(msg);
        case 'faixa': return mostrarFaixa(msg);
        case 'curtidas': return mostrarCurtidas(msg);
        case 'agradecidos': return mostrarAgradecidos(msg);
      }
    } catch (e) {
      console.error('Erro ao mostrar na tela:', e);
    }
  }

  if (window.vl?.aoMostrar) window.vl.aoMostrar(receber);
  else console.error('Ponte window.vl indisponível na tela.');
})();
