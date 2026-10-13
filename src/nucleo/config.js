import fs from 'node:fs/promises';
import path from 'node:path';

export const PADRAO = Object.freeze({
  esperaMin: 5,
  tempoComentarioS: 8,
  tempoPresenteS: 12,
  tempoSeguidorS: 5,
  tempoMetaS: 10,
  metaCurtidas: 1000,
  arroba: '',
  musica: false,
  volumeMusica: 30,
});

const LIMITES = {
  esperaMin: [0, 60],
  tempoComentarioS: [2, 60],
  tempoPresenteS: [2, 60],
  tempoSeguidorS: [2, 60],
  tempoMetaS: [2, 60],
  metaCurtidas: [10, 1000000],
  volumeMusica: [0, 100],
};

export function normalizarConfig(obj) {
  const entrada = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  const config = {};
  for (const [campo, [min, max]] of Object.entries(LIMITES)) {
    const v = entrada[campo];
    const valido = typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
    config[campo] = valido ? v : PADRAO[campo];
  }
  config.arroba = typeof entrada.arroba === 'string' ? entrada.arroba : PADRAO.arroba;
  config.musica = typeof entrada.musica === 'boolean' ? entrada.musica : PADRAO.musica;
  return config;
}

export async function lerConfig(caminho) {
  try {
    return normalizarConfig(JSON.parse(await fs.readFile(caminho, 'utf8')));
  } catch {
    return normalizarConfig(null);
  }
}

export async function salvarConfig(caminho, mudancas) {
  const atual = await lerConfig(caminho);
  const nova = normalizarConfig({ ...atual, ...mudancas });
  await fs.mkdir(path.dirname(caminho), { recursive: true });
  await fs.writeFile(caminho, JSON.stringify(nova, null, 2), 'utf8');
  return nova;
}
