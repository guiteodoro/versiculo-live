// Converte os eventos do tiktok-live-connector para o formato padrão do app (spec §5).
// A versão 2.5.0 emite as mensagens do proto v3 (user.id, user.displayId, content,
// count/total, gift.*); o README ainda mostra os nomes antigos (userId, uniqueId,
// comment, likeCount, giftDetails). Aceitamos os dois.

const ARROBA_VALIDA = /^[a-z0-9._]{2,24}$/;

export function limparArroba(bruto) {
  let texto = String(bruto ?? '').trim().toLowerCase();
  const doLink = texto.match(/tiktok\.com\/@([^/?#\s]+)/);
  if (doLink) texto = doLink[1];
  texto = texto.replace(/^@/, '');
  return ARROBA_VALIDA.test(texto) ? texto : '';
}

function primeiraUrl(imagem) {
  const lista = imagem?.url ?? imagem?.urlList;
  return Array.isArray(lista) && lista.length > 0 ? lista[0] : null;
}

function texto(valor) {
  return valor === undefined || valor === null || valor === '' ? undefined : String(valor);
}

export function usuarioDe(u) {
  const nick = texto(u.nickname);
  const arroba = texto(u.uniqueId) ?? texto(u.displayId) ?? nick ?? 'alguém';
  const nome = nick ?? arroba;
  const id = texto(u.userId) ?? texto(u.id) ?? texto(u.uniqueId) ?? texto(u.displayId) ?? nick ?? 'desconhecido';
  const foto =
    primeiraUrl(u.profilePicture) ?? primeiraUrl(u.avatarThumb) ?? null;
  return { id, arroba, nome, foto };
}

function numero(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

export function deChat(d) {
  if (!d?.user) return null;
  return { tipo: 'comentario', usuario: usuarioDe(d.user), texto: d.comment ?? d.content ?? '' };
}

export function deGift(d) {
  if (!d?.user) return null;
  return {
    tipo: 'presente-bruto',
    usuario: usuarioDe(d.user),
    presente: {
      nome:
        texto(d.giftDetails?.giftName) ?? texto(d.gift?.name) ?? texto(d.extendedGiftInfo?.name) ?? 'presente',
      quantidade: d.repeatCount || 1,
      diamantes: d.giftDetails?.diamondCount ?? d.gift?.diamondCount ?? 0,
      imagem: primeiraUrl(d.giftDetails?.giftImage) ?? primeiraUrl(d.gift?.image) ?? null,
    },
    sequencia: (d.giftDetails?.giftType ?? d.gift?.type) === 1,
    fim: Boolean(d.repeatEnd),
  };
}

export function deFollow(d) {
  if (!d?.user) return null;
  return { tipo: 'seguiu', usuario: usuarioDe(d.user) };
}

export function deLike(d) {
  if (!d?.user) return null;
  return {
    tipo: 'curtidas',
    usuario: usuarioDe(d.user),
    quantidade: numero(d.likeCount ?? d.count),
    totalDaLive: numero(d.totalLikeCount ?? d.total),
  };
}

// Número de espectadores de um evento roomUser, ou null se não vier.
export function espectadoresDe(d) {
  const bruto = d?.viewerCount ?? d?.total;
  if (bruto === undefined || bruto === null || bruto === '') return null;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : null;
}
