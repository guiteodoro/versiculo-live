import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { limparArroba, usuarioDe, deChat, deGift, deFollow, deLike } from '../src/nucleo/adaptador.js';

const amostra = (nome) =>
  JSON.parse(readFileSync(new URL(`./amostras/${nome}.json`, import.meta.url), 'utf8'));

test('limparArroba', () => {
  assert.equal(limparArroba('@Maria.Silva '), 'maria.silva');
  assert.equal(limparArroba('https://www.tiktok.com/@joao_fe/live'), 'joao_fe');
  assert.equal(limparArroba('a'), '');
  assert.equal(limparArroba('nome com espaço'), '');
  assert.equal(limparArroba('tiktok.com/@Ana_B'), 'ana_b');
  assert.equal(limparArroba('  NOME  '), 'nome');
  assert.equal(limparArroba(''), '');
  assert.equal(limparArroba(undefined), '');
});

test('adapta cada amostra para o formato padrão', () => {
  const usuario = {
    id: '7000000000000000001',
    arroba: 'usuario_teste',
    nome: 'Usuário Teste',
    foto: 'https://exemplo.invalid/foto.jpg',
  };

  assert.deepEqual(deChat(amostra('chat')), { tipo: 'comentario', usuario, texto: 'Deus é fiel, amém' });

  assert.deepEqual(deGift(amostra('gift-sequencia')), {
    tipo: 'presente-bruto',
    usuario,
    presente: { nome: 'Rose', quantidade: 3, diamantes: 1, imagem: 'https://exemplo.invalid/rosa.webp' },
    sequencia: true,
    fim: false,
  });

  const fim = deGift(amostra('gift-fim'));
  assert.equal(fim.presente.quantidade, 10);
  assert.equal(fim.sequencia, true);
  assert.equal(fim.fim, true);

  assert.deepEqual(deFollow(amostra('follow')), {
    tipo: 'seguiu',
    usuario: { id: '7000000000000000002', arroba: 'seguidor_teste', nome: 'Seguidor Teste', foto: null },
  });

  assert.deepEqual(deLike(amostra('like')), { tipo: 'curtidas', usuario, quantidade: 15, totalDaLive: 1234 });
});

test('aceita os nomes de campo do README (formato antigo)', () => {
  const user = { userId: '42', uniqueId: 'fulano', nickname: '', profilePicture: { url: ['https://exemplo.invalid/a.jpg'] } };
  assert.deepEqual(usuarioDe(user), { id: '42', arroba: 'fulano', nome: 'fulano', foto: 'https://exemplo.invalid/a.jpg' });
  assert.equal(usuarioDe({ uniqueId: 'x', profilePicture: { urlList: ['u1'] } }).foto, 'u1');
  assert.equal(usuarioDe({ uniqueId: 'x', avatarThumb: { url: ['u2'] } }).foto, 'u2');

  assert.equal(deChat({ user, comment: 'olá' }).texto, 'olá');

  const presente = deGift({
    user,
    repeatCount: 0,
    repeatEnd: true,
    giftDetails: { giftName: 'Galaxy', diamondCount: 1000, giftType: 2 },
  });
  assert.deepEqual(presente.presente, { nome: 'Galaxy', quantidade: 1, diamantes: 1000, imagem: null });
  assert.equal(presente.sequencia, false);
  assert.equal(presente.fim, true);

  assert.equal(deGift({ user, extendedGiftInfo: { name: 'Leão' } }).presente.nome, 'Leão');
  assert.equal(deGift({ user }).presente.nome, 'presente');
  assert.equal(deGift({ user }).presente.diamantes, 0);

  const curtidas = deLike({ user, likeCount: 7, totalLikeCount: 300 });
  assert.equal(curtidas.quantidade, 7);
  assert.equal(curtidas.totalDaLive, 300);
});

test('usuarioDe sempre devolve id não vazio', () => {
  assert.equal(usuarioDe({ uniqueId: 'so_arroba' }).id, 'so_arroba');
  assert.equal(usuarioDe({ nickname: 'Só Nome' }).id, 'Só Nome');
  assert.equal(usuarioDe({}).id, 'desconhecido');
  assert.equal(usuarioDe({}).foto, null);
});

test('evento sem user vira null', () => {
  assert.equal(deChat({ content: 'oi' }), null);
  assert.equal(deGift({ repeatCount: 1 }), null);
  assert.equal(deFollow({}), null);
  assert.equal(deLike({ count: 3 }), null);
  assert.equal(deChat(undefined), null);
});

test('usuarioDe: arroba nunca fica vazia (displayId → nickname → "alguém")', () => {
  assert.equal(usuarioDe({ uniqueId: '', displayId: 'pelo_display' }).arroba, 'pelo_display');
  assert.equal(usuarioDe({ uniqueId: '', displayId: '', nickname: 'Só Nome' }).arroba, 'Só Nome');
  assert.equal(usuarioDe({ uniqueId: '', displayId: '' }).arroba, 'alguém');
  assert.equal(usuarioDe({}).arroba, 'alguém');
  assert.equal(usuarioDe({}).nome, 'alguém');
});

test('nome do presente: gift.name antes de extendedGiftInfo, vazio vira "presente"', () => {
  const user = { uniqueId: 'fulano' };
  assert.equal(deGift({ user, gift: { name: 'Rose' }, extendedGiftInfo: { name: 'Outro' } }).presente.nome, 'Rose');
  assert.equal(deGift({ user, gift: { name: '' }, extendedGiftInfo: { name: 'Leão' } }).presente.nome, 'Leão');
  assert.equal(deGift({ user, gift: { name: '' } }).presente.nome, 'presente');
  assert.equal(deGift({ user, giftDetails: { giftName: '' }, gift: { name: '' } }).presente.nome, 'presente');
});
