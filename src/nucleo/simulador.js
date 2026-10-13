// Gera eventos falsos no mesmo formato da live real, para testar sem estar ao vivo.

export const USUARIOS_TESTE = [
  ['maria.teste', 'Maria (teste)'],
  ['joao.teste', 'João (teste)'],
  ['ana.teste', 'Ana (teste)'],
  ['pedro.teste', 'Pedro (teste)'],
  ['lucia.teste', 'Lúcia (teste)'],
  ['carlos.teste', 'Carlos (teste)'],
  ['beatriz.teste', 'Beatriz (teste)'],
  ['tiago.teste', 'Tiago (teste)'],
].map(([arroba, nome], i) => ({ id: `teste-${i + 1}`, arroba, nome, foto: null }));

export const TEXTOS_COMENTARIO = [
  'Estou com muita ansiedade hoje, ora por mim',
  'Minha ansiedade não me deixa dormir',
  'Preciso de paz para a minha família',
  'Orem pela minha família, estamos passando por um momento difícil',
  'Gratidão por mais um dia de vida',
  'Sou grato a Deus por tudo',
  'Boa noite, pessoal',
  'Boa noite a todos 🙏',
  '🙏🙏',
  'Deus abençoe essa live',
  'Estou com medo do futuro',
];

export function criarSimulador({ aoEvento, aleatorio = Math.random }) {
  let proximoSeguidor = 0;

  const sortear = (lista) => lista[Math.min(lista.length - 1, Math.floor(aleatorio() * lista.length))];

  return {
    comentario() {
      aoEvento({ tipo: 'comentario', usuario: sortear(USUARIOS_TESTE), texto: sortear(TEXTOS_COMENTARIO) });
    },

    presente() {
      const usuario = sortear(USUARIOS_TESTE);
      const bruto = (quantidade, sequencia, fim) => ({
        tipo: 'presente-bruto',
        usuario,
        presente: { nome: 'Rosa', quantidade, diamantes: 1, imagem: null },
        sequencia,
        fim,
      });
      for (let q = 1; q <= 10; q++) aoEvento(bruto(q, true, false));
      aoEvento(bruto(10, true, true));
    },

    seguidor() {
      const usuario = USUARIOS_TESTE[proximoSeguidor % USUARIOS_TESTE.length];
      proximoSeguidor++;
      aoEvento({ tipo: 'seguiu', usuario });
    },

    curtidas(n = 500) {
      aoEvento({ tipo: 'curtidas', usuario: sortear(USUARIOS_TESTE), quantidade: n, totalDaLive: null });
    },
  };
}
