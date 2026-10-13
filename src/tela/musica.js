// src/tela/musica.js
// Música ambiente gerada na hora (Web Audio): acordes longos e suaves com eco leve
// e um "sininho" de vez em quando. Não há arquivo de áudio, então não há direitos autorais.
'use strict';

(() => {
  const ACORDE_S = 8; // cada acorde dura ~8 s (com sobreposição na troca)
  const ATAQUE_S = 3;
  const SOLTURA_S = 4;
  // C maj9 → A m7 → F maj7 → G sus/6: progressão calma, sem tensão
  const ACORDES = [
    [130.81, 164.81, 196.0, 246.94, 293.66],
    [110.0, 130.81, 164.81, 196.0, 261.63],
    [87.31, 130.81, 174.61, 220.0, 261.63],
    [98.0, 146.83, 196.0, 220.0, 293.66],
  ];
  const SINOS = [523.25, 587.33, 659.25, 783.99, 880.0]; // pentatônica de dó

  let ctx = null;
  let mestre = null; // volume geral
  let eco = null; // entrada do reverb
  let relogio = null;
  let sinoTimer = null;
  let indice = 0;
  let ligada = false;
  let volume = 30;

  function respostaDeEco(segundos) {
    const n = Math.floor(ctx.sampleRate * segundos);
    const buffer = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let canal = 0; canal < 2; canal++) {
      const dados = buffer.getChannelData(canal);
      for (let i = 0; i < n; i++) dados[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
    }
    return buffer;
  }

  function montar() {
    ctx = new AudioContext();
    mestre = ctx.createGain();
    mestre.gain.value = 0;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 1400;
    const reverb = ctx.createConvolver();
    reverb.buffer = respostaDeEco(3.5);
    const molhado = ctx.createGain();
    molhado.gain.value = 0.45;
    eco = ctx.createGain();
    eco.connect(filtro);
    filtro.connect(mestre); // direto
    filtro.connect(reverb);
    reverb.connect(molhado);
    molhado.connect(mestre);
    mestre.connect(ctx.destination);
  }

  function tocarAcorde() {
    const notas = ACORDES[indice % ACORDES.length];
    indice++;
    const t0 = ctx.currentTime + 0.05;
    const fim = t0 + ACORDE_S + SOLTURA_S;
    for (const freq of notas) {
      for (const [tipo, desafino, ganho] of [['sine', 0, 0.05], ['triangle', 4, 0.018]]) {
        const osc = ctx.createOscillator();
        osc.type = tipo;
        osc.frequency.value = freq;
        osc.detune.value = desafino;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t0);
        env.gain.linearRampToValueAtTime(ganho, t0 + ATAQUE_S);
        env.gain.setValueAtTime(ganho, t0 + ACORDE_S);
        env.gain.linearRampToValueAtTime(0, fim);
        osc.connect(env);
        env.connect(eco);
        osc.start(t0);
        osc.stop(fim + 0.1);
      }
    }
  }

  function tocarSino() {
    const freq = SINOS[Math.floor(Math.random() * SINOS.length)];
    const t0 = ctx.currentTime + 0.05;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(0.035, t0 + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 3);
    osc.connect(env);
    env.connect(eco);
    osc.start(t0);
    osc.stop(t0 + 3.1);
  }

  function agendarSino() {
    sinoTimer = setTimeout(() => {
      if (ligada) tocarSino();
      agendarSino();
    }, 4000 + Math.random() * 5000);
  }

  function aplicarVolume() {
    if (!mestre) return;
    const alvo = ligada ? (volume / 100) ** 2 * 0.9 : 0;
    const agora = ctx.currentTime;
    mestre.gain.cancelScheduledValues(agora);
    mestre.gain.setValueAtTime(mestre.gain.value, agora);
    mestre.gain.linearRampToValueAtTime(alvo, agora + 1.5);
  }

  function ligar() {
    if (!ctx) montar();
    if (ctx.state === 'suspended') ctx.resume();
    if (!relogio) {
      tocarAcorde();
      relogio = setInterval(tocarAcorde, ACORDE_S * 1000);
      agendarSino();
    }
  }

  function desligar() {
    clearInterval(relogio);
    clearTimeout(sinoTimer);
    relogio = null;
    sinoTimer = null;
    // deixa o volume cair suavemente antes de suspender
    setTimeout(() => { if (!ligada && ctx) ctx.suspend(); }, 2000);
  }

  function definir(opcoes) {
    const novaLigada = opcoes?.ligada === true;
    const novoVolume = Number(opcoes?.volume);
    if (Number.isFinite(novoVolume)) volume = Math.max(0, Math.min(100, novoVolume));
    if (novaLigada && !ligada) { ligada = true; ligar(); }
    else if (!novaLigada && ligada) { ligada = false; desligar(); }
    aplicarVolume();
  }

  function estado() {
    return { ligada, volume, contexto: ctx?.state ?? 'nenhum' };
  }

  window.musicaAmbiente = { definir, estado };
})();
