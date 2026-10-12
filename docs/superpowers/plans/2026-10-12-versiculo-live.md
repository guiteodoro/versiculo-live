# Versículo Live — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App Electron pessoal que lê a live do TikTok e mostra, numa janela 9:16, o @ de quem comenta/presenteia/segue com um versículo bíblico.

**Architecture:** Lógica pura e testável em `src/nucleo/` (texto, versículos, filtro, fila, combos, curtidas, config, diretor, adaptador, conexão, simulador), sem Electron. `src/main.js` liga as peças e as duas janelas (controle e tela) via IPC por um `preload.cjs`. Tempo é injetado (relógio/`mock.timers`) para tudo ser testado sem esperar.

**Tech Stack:** Node 20.18 (testes) · Electron 44.7.0 · tiktok-live-connector 2.5.0 (ESM, não oficial) · `node:test` · HTML/CSS/JS puros. Projeto todo em ESM (`"type": "module"`), exceto o preload (`.cjs`).

**Spec:** `docs/superpowers/specs/2026-10-12-versiculo-live-design.md`

## Global Constraints

- Uso pessoal, Windows 11, interface e textos em português do Brasil.
- Nenhum texto na tela associa presente a bênção/oração/favor, nem pede presentes.
- Sem framework de interface, sem empacotador, sem instalador. Inicia com `npm start`.
- Dependências de produção: só `tiktok-live-connector@2.5.0`. Dev: só `electron@44.7.0`.
- Testes: `node --test` (pasta `testes/`), sem bibliotecas extras.
- Padrões (spec §9): `esperaMin 5`, `tempoComentarioS 8`, `tempoPresenteS 12`, `tempoSeguidorS 5`, `tempoMetaS 10`, `metaCurtidas 1000`.
- Fila de comentários máx. **20**; faixas de seguidor pendentes máx. **3**; não repetir os **10** últimos versículos; combo fecha **5 s** após o último aviso.
- Reconexão: 5, 10, 20, 30 s, depois a cada 30 s. Sem live: tenta a cada 30 s.
- Janela da tela: título `Versículo Live — Tela`, 540×960, proporção 9:16 travada. Controle ≈ 760×620.
- @ com mais de 22 caracteres cortado com "…".

## Review Focus

1. **Comentário só com emoji, só espaços ou vazio** — emoji/sem palavras reconhecíveis vira versículo do tema `geral`; texto vazio/só espaços é ignorado (Task 8).
2. **@ digitado de jeitos diferentes** (`@Nome`, `nome `, link `tiktok.com/@nome/live`, maiúsculas) — todos viram `nome`; lixo vira `""` e a conexão recusa com mensagem (Task 9).
3. **Trocar de @ ou desconectar com a conexão antiga ainda emitindo** — eventos e reconexões da conexão antiga são descartados (Task 9).
4. **Mesma pessoa com dois combos simultâneos de presentes diferentes** — cada combo fecha separado, com a quantidade certa (Task 5).
5. **`versiculos.json` quebrado ou com tema sem versículos** — o app não trava: valida, avisa e usa os exemplos embutidos (Task 2).

---

### Task 1: Base do projeto + utilitários de texto

**Files:**
- Create: `package.json`, `.gitignore`, `src/nucleo/texto.js`
- Test: `testes/texto.test.js`

**Interfaces:**
- Produces: `normalizar(s: string): string` (minúsculas, sem acento, pontuação vira espaço, espaços colapsados, trim); `palavras(s: string): string[]` (de `normalizar`, separa por espaço, descarta vazias); `distancia(a: string, b: string): number` (Levenshtein); `cortar(s: string, max: number): string` (se `[...s].length > max`, primeiros `max-1` caracteres + "…"; conta por code point para não partir emoji).

- [ ] **Step 1: Criar `package.json` e `.gitignore`, instalar**

`package.json`: `"name": "versiculo-live"`, `"private": true`, `"type": "module"`, `"main": "src/main.js"`, scripts `"start": "electron ."`, `"test": "node --test testes/"`. Depois:
```bash
npm install tiktok-live-connector@2.5.0
npm install -D electron@44.7.0
git init
```
`.gitignore`: `node_modules/`, `.superpowers/`.

- [ ] **Step 2: Escrever testes que falham**

```js
// testes/texto.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, palavras, distancia, cortar } from '../src/nucleo/texto.js';

test('normalizar tira acento, pontuação e caixa', () => {
  assert.equal(normalizar('  Orem pela minha ANSIEDADE!!  '), 'orem pela minha ansiedade');
  assert.equal(normalizar('Família, saúde e fé'), 'familia saude e fe');
});
test('palavras ignora emoji e vazios', () => {
  assert.deepEqual(palavras('🙏🙏 amém, irmão'), ['amem', 'irmao']);
  assert.deepEqual(palavras('🙏🔥'), []);
});
test('distancia', () => {
  assert.equal(distancia('ansiedad', 'ansiedade'), 1);
  assert.equal(distancia('familia', 'familia'), 0);
  assert.equal(distancia('medo', 'cura'), 4);
});
test('cortar', () => {
  assert.equal(cortar('abc', 22), 'abc');
  assert.equal(cortar('a'.repeat(30), 22), 'a'.repeat(21) + '…');
  assert.equal([...cortar('😀'.repeat(30), 22)].length, 22);
});
```

- [ ] **Step 3: Rodar e ver falhar** — `npm test` → FAIL (módulo não existe)
- [ ] **Step 4: Implementar `src/nucleo/texto.js`** — acento via `normalize('NFD').replace(/\p{Diacritic}/gu,'')`; pontuação/símbolos/emoji via `replace(/[^\p{L}\p{N}\s]/gu,' ')`.
- [ ] **Step 5: Rodar** — `npm test` → PASS
- [ ] **Step 6: Commit** — `git add -A && git commit -m "chore: base do projeto e utilitários de texto"`

---

### Task 2: Versículos

**Files:**
- Create: `src/nucleo/versiculos.js`, `src/nucleo/versiculos-exemplo.js`, `dados/versiculos.json`
- Test: `testes/versiculos.test.js`

**Interfaces:**
- Consumes: `normalizar`, `palavras`, `distancia` (Task 1).
- Produces:
  - `validarDados(json: unknown): { ok: true } | { ok: false, erro: string }` — exige `temas` array não vazio; cada tema com `id` string, `palavras` array, `versiculos` array **não vazio** de `{ref, texto}` strings; exige temas `geral`, `boas-vindas`, `comunidade`. `erro` em português citando o tema/campo.
  - `criarVersiculos(dados, { aleatorio = Math.random, evitar = 10 } = {})` → `{ temaDe(texto: string): string, escolher(texto: string): Versiculo, doTema(id: string): Versiculo }`, `Versiculo = { ref, texto, tema }`. `doTema` de id inexistente usa `geral`.
  - `EXEMPLO` (export de `versiculos-exemplo.js`): dados válidos com os temas `ansiedade`, `familia`, `geral`, `gratidao`, `boas-vindas`, `comunidade`, 3 versículos cada — usados nos testes, como conteúdo inicial de `dados/versiculos.json` e como reserva quando o arquivo é inválido.

Algoritmo de `temaDe` (spec §7): para cada palavra do comentário e cada palavra-chave (normalizada) de cada tema, acerto se igual, ou se `palavra.length >= 5 && distancia <= 1`. Tema com mais acertos vence; empate → primeiro no arquivo; nenhum → `geral`. Temas `geral`, `boas-vindas`, `comunidade` não participam da busca.

Não repetição: histórico global dos últimos `evitar` versículos (por `ref`). Sorteia entre os do tema fora do histórico; se todos estiverem no histórico, sorteia entre os que saíram há mais tempo (o mais antigo no histórico).

- [ ] **Step 1: Testes que falham**

```js
// testes/versiculos.test.js — usa EXEMPLO e aleatorio fixo () => 0
test('tema por palavra-chave, sem acento e com erro de digitação', () => {
  const v = criarVersiculos(EXEMPLO, { aleatorio: () => 0 });
  assert.equal(v.temaDe('orem pela minha ANSIEDADE'), 'ansiedade');
  assert.equal(v.temaDe('ansiedad demais'), 'ansiedade');
  assert.equal(v.temaDe('minha familia'), 'familia');
  assert.equal(v.temaDe('boa noite'), 'geral');
  assert.equal(v.temaDe('🙏🙏'), 'geral');
});
test('empate fica com o primeiro tema do arquivo', () => {
  const v = criarVersiculos(EXEMPLO);
  assert.equal(v.temaDe('ansiedade na familia'), 'ansiedade'); // ansiedade vem antes em EXEMPLO
});
test('não repete enquanto houver opção', () => {
  const v = criarVersiculos(EXEMPLO, { aleatorio: () => 0 });
  const refs = [1, 2, 3].map(() => v.doTema('geral').ref);
  assert.equal(new Set(refs).size, 3);
});
test('tema esgotado repete o mais antigo', () => {
  const v = criarVersiculos(EXEMPLO, { aleatorio: () => 0 });
  const refs = [1, 2, 3, 4].map(() => v.doTema('geral').ref);
  assert.equal(refs[3], refs[0]);
});
test('validarDados recusa arquivo quebrado e tema vazio', () => {
  assert.equal(validarDados(EXEMPLO).ok, true);
  assert.equal(validarDados(null).ok, false);
  const semVers = structuredClone(EXEMPLO); semVers.temas[0].versiculos = [];
  const r = validarDados(semVers);
  assert.equal(r.ok, false); assert.match(r.erro, /ansiedade/);
  const semGeral = { temas: EXEMPLO.temas.filter(t => t.id !== 'geral') };
  assert.equal(validarDados(semGeral).ok, false);
});
```

- [ ] **Step 2: Rodar** — `npm test` → FAIL
- [ ] **Step 3: Implementar** `versiculos-exemplo.js`, `versiculos.js`; gravar `dados/versiculos.json` = `EXEMPLO` + `"traducao": "exemplo — substituir na Task 13"`. Textos de exemplo: frases curtas parafraseadas, marcadas como exemplo.
- [ ] **Step 4: Rodar** — `npm test` → PASS
- [ ] **Step 5: Commit** — `feat: escolha de versículo por tema`

---

### Task 3: Filtro de palavras bloqueadas

**Files:**
- Create: `src/nucleo/filtro.js`, `dados/bloqueadas.txt`
- Test: `testes/filtro.test.js`

**Interfaces:**
- Consumes: `normalizar` (Task 1).
- Produces: `criarFiltro(conteudoDoArquivo: string)` → `{ bloqueia(texto: string): boolean }`. Uma entrada por linha; linhas vazias e iniciadas por `#` ignoradas. Compara normalizado e por **palavra/expressão inteira** (`" " + texto + " "` contém `" " + entrada + " "`), para "cu" não bloquear "cura".

- [ ] **Step 1: Testes que falham**

```js
test('bloqueia palavra e expressão inteiras, sem acento', () => {
  const f = criarFiltro('# comentário\nidiota\nvai se ferrar\n\n');
  assert.equal(f.bloqueia('Seu IDIOTA'), true);
  assert.equal(f.bloqueia('vai se ferrár'), true);
  assert.equal(f.bloqueia('idiotas'), false);
  assert.equal(f.bloqueia('boa noite'), false);
});
test('entrada curta não pega dentro de palavra', () => {
  assert.equal(criarFiltro('cu').bloqueia('preciso de cura'), false);
});
```

- [ ] **Step 2: Rodar** → FAIL · **Step 3: Implementar** + `bloqueadas.txt` com cabeçalho `# uma palavra ou expressão por linha` e uma lista inicial de palavrões/ofensas comuns em pt-BR · **Step 4: Rodar** → PASS · **Step 5: Commit** — `feat: filtro de palavras bloqueadas`

---

### Task 4: Fila com prioridade e tempo de espera

**Files:**
- Create: `src/nucleo/fila.js`
- Test: `testes/fila.test.js`

**Interfaces:**
- Produces: `criarFila({ esperaMs: number, maxComentarios = 20, agora = Date.now })` →
  - `adicionarComentario(evento): boolean` — recusa (false) se a pessoa (`usuario.id`) entrou na fila há menos de `esperaMs` (spec §6.1: conta da entrada na fila). Se a fila tiver `maxComentarios`, remove o mais antigo e aceita.
  - `adicionarPresente(evento): void` — sem espera, sem limite, FIFO.
  - `proximo(): evento | null` — presentes primeiro, depois comentários.
  - `devolverComentario(evento): void` — recoloca no **início** da fila de comentários (não conta como nova entrada).
  - `aSeguir(n: number): { arrobas: string[], resto: number }` — próximos `n` na ordem de `proximo()`, e quantos sobram.
  - `definirEspera(ms)`, `tamanho(): number`.

- [ ] **Step 1: Testes que falham** (relógio falso `let t = 0; agora: () => t`)

```js
test('presente sai antes de comentário', ...)        // adiciona c1, p1 → proximo() === p1, depois c1
test('espera por pessoa conta da entrada na fila', () => {
  // esperaMs 300000; c(ana) aceito em t=0; c(ana) em t=299999 recusado; em t=300000 aceito
});
test('presente ignora a espera e não a altera', ...) // ana comenta t=0; presente de ana aceito t=1; comentário de ana t=2 recusado
test('limite de 20 descarta o mais antigo', ...)     // 21 pessoas → tamanho 20 e o primeiro sumiu
test('devolverComentario volta para o início', ...)
test('aSeguir', ...)                                 // 6 na fila, aSeguir(3) → 3 arrobas e resto 3
```

- [ ] **Step 2: Rodar** → FAIL · **Step 3: Implementar** · **Step 4: Rodar** → PASS · **Step 5: Commit** — `feat: fila com prioridade`

---

### Task 5: Combos de presentes

**Files:**
- Create: `src/nucleo/combos.js`
- Test: `testes/combos.test.js`

**Interfaces:**
- Consumes: "presente bruto" (produzido pelo adaptador, Task 9, e pelo simulador, Task 10): `{ tipo: 'presente-bruto', usuario, presente: { nome, quantidade, diamantes, imagem }, sequencia: boolean, fim: boolean }` — `quantidade` é o total acumulado do combo (`repeatCount`).
- Produces: `criarCombos({ emitir: (evento) => void, limiteMs = 5000 })` → `{ receber(bruto): void, parar(): void }`. Emite `{ tipo: 'presente', usuario, presente }`.
  - `sequencia === false` → emite na hora.
  - `sequencia === true`: chave `usuario.id + '|' + presente.nome`; guarda o mais recente; `fim === true` → emite e esquece; sem novo aviso em `limiteMs` → emite o último recebido. `parar()` cancela os timers sem emitir.

- [ ] **Step 1: Testes que falham** (usar `t.mock.timers.enable({ apis: ['setTimeout'] })`)

```js
test('presente sem sequência sai na hora', ...)
test('combo emite uma vez no fim com a quantidade final', ...)    // q=1..10 fim=false, depois q=10 fim=true → 1 emissão, quantidade 10
test('combo sem aviso de fim fecha após 5 s', ...)               // q=3, tick(4999) → 0; tick(1) → 1 emissão com 3
test('dois combos da mesma pessoa com presentes diferentes', ...) // rosa e coração intercalados → 2 emissões, cada uma com sua quantidade
```

- [ ] **Step 2: Rodar** → FAIL · **Step 3: Implementar** (reinicia o timer da chave a cada aviso) · **Step 4: Rodar** → PASS · **Step 5: Commit** — `feat: agrupar combos de presentes`

---

### Task 6: Curtidas

**Files:**
- Create: `src/nucleo/curtidas.js`
- Test: `testes/curtidas.test.js`

**Interfaces:**
- Produces: `criarCurtidas({ meta: number })` → `{ somar(n: number): { total, meta, bateuMeta: boolean }, definirMeta(passo: number): void, estado(): { total, meta } }`. `total` = soma desde a conexão. Ao atingir `total >= meta`: `bateuMeta: true` uma vez, e a meta avança em `passo` até ficar acima de `total` (uma única comemoração mesmo se pular duas metas). `definirMeta` muda o passo e recalcula a próxima meta como o menor múltiplo de `passo` acima de `total`.

- [ ] **Step 1: Testes que falham**

```js
test('bate a meta e avança', () => {
  const c = criarCurtidas({ meta: 1000 });
  assert.deepEqual(c.somar(600), { total: 600, meta: 1000, bateuMeta: false });
  assert.deepEqual(c.somar(500), { total: 1100, meta: 2000, bateuMeta: true });
});
test('pular duas metas comemora uma vez', () => {
  const c = criarCurtidas({ meta: 1000 });
  assert.deepEqual(c.somar(2500), { total: 2500, meta: 3000, bateuMeta: true });
});
test('definirMeta recalcula', () => {
  const c = criarCurtidas({ meta: 1000 }); c.somar(1200);
  c.definirMeta(500); assert.equal(c.estado().meta, 1500);
});
```

- [ ] **Step 2–5:** rodar FAIL → implementar → PASS → commit `feat: meta de curtidas`

---

### Task 7: Configurações

**Files:**
- Create: `src/nucleo/config.js`
- Test: `testes/config.test.js`

**Interfaces:**
- Produces: `PADRAO` (spec §9, com `arroba: ""`); `normalizarConfig(obj: unknown): Config` — cada campo numérico precisa ser número finito dentro de limites (`esperaMin` 0–60, tempos em s 2–60, `metaCurtidas` 10–1.000.000), senão volta ao padrão; `arroba` string, senão `""`; campos desconhecidos descartados. `lerConfig(caminho): Promise<Config>` (arquivo ausente ou JSON inválido → `PADRAO`); `salvarConfig(caminho, mudancas): Promise<Config>` (lê, mescla, normaliza, grava, devolve).

- [ ] **Step 1: Testes que falham** — padrões; `esperaMin: -3` → 5; `tempoComentarioS: "8"` → 8 (padrão, pois não é número); campo extra some; `lerConfig` de arquivo inexistente e de arquivo com `{lixo` → `PADRAO`; `salvarConfig` grava e relê (usar `fs.mkdtemp` em `os.tmpdir()`).
- [ ] **Step 2–5:** FAIL → implementar → PASS → commit `feat: configurações`

---

### Task 8: Diretor (o que aparece na tela e quando)

**Files:**
- Create: `src/nucleo/diretor.js`
- Test: `testes/diretor.test.js`

**Interfaces:**
- Consumes: `criarFila` (4), `criarVersiculos` (2), `criarCurtidas` (6), `criarFiltro` (3), `cortar` (1).
- Produces: `criarDiretor({ versiculos, filtro, config, mostrar, agora = Date.now })` →
  - `receber(evento)` — eventos padrão (spec §5) já sem combo.
  - `atualizarConfig(config)`, `reiniciar()` (zera fila, curtidas e seguidores vistos; usado ao conectar), `parar()`.
  - `mostrar(mensagem)` é chamado com:
    - `{ canal: 'cartao', tipo: 'comentario' | 'presente', usuario, versiculo, presente?, duracaoMs, aSeguir }`
    - `{ canal: 'cartao', tipo: 'meta', versiculo, meta, duracaoMs }`
    - `{ canal: 'faixa', usuario, versiculo, duracaoMs }`
    - `{ canal: 'curtidas', total, meta }`
    - `{ canal: 'fila', tamanho }` — sempre que o tamanho da fila mudar (status "fila: 6" do controle)
    - `{ canal: 'registro', texto }` — linha para a lista de eventos do controle (ex.: `💬 @ana: "minha ansiedade" → Filipenses 4:6`, `🚫 comentário bloqueado de @x`).
  - `usuario.arroba` já vem cortado em 22 caracteres; usuário com @ bloqueado: comentários/seguidas ignorados, presente aparece com `arroba: 'anônimo'`.

Regras (spec §6): versículo escolhido **na hora de exibir** (comentário → `escolher(texto)`, presente → `doTema('gratidao')`, seguidor → `doTema('boas-vindas')`, meta → `doTema('comunidade')`). Comentário vazio/só espaços ignorado. Presente chega com comentário na tela → `devolverComentario` do atual e mostra o presente já. Presente chega com presente ou meta na tela → espera. Meta batida → fica pendente e entra quando o cartão atual acabar, antes da fila. Faixas: canal próprio, máx. 3 pendentes, uma por pessoa por sessão. Tempos vêm de `config` (s → ms; espera em min → ms via `fila.definirEspera`).

- [ ] **Step 1: Testes que falham** (`t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })`, `mostrar` coleta mensagens num array, versículos com `EXEMPLO` e `aleatorio: () => 0`)

```js
test('comentário vira cartão de 8 s com versículo do tema', ...)
test('comentário vazio é ignorado e só-emoji vira geral', ...)
test('presente interrompe comentário e o comentário volta depois', ...)
  // c(ana) mostrado; tick(2000); presente(bia) → cartão presente imediato;
  // tick(12000) → cartão comentário de ana de novo
test('presente não interrompe outro presente', ...)
test('meta entra depois do cartão atual e antes da fila', ...)
test('faixa de seguidor: uma por pessoa e no máximo 3 pendentes', ...)
test('@ bloqueado: comentário ignorado, presente como anônimo', ...)
test('curtidas atualizam a barra', ...)
test('aSeguir acompanha o cartão', ...)
```

- [ ] **Step 2: Rodar** → FAIL · **Step 3: Implementar** · **Step 4: Rodar** → PASS · **Step 5: Commit** — `feat: diretor de exibição`

---

### Task 9: Adaptador e conexão com o TikTok

**Files:**
- Create: `src/nucleo/adaptador.js`, `src/nucleo/conexao-tiktok.js`
- Test: `testes/adaptador.test.js`, `testes/conexao.test.js`, `testes/amostras/*.json`

**Interfaces:**
- Produces (`adaptador.js`):
  - `limparArroba(bruto: string): string` — aceita `@Nome`, espaços, link `tiktok.com/@nome[/live]`; devolve minúsculo, `/^[a-z0-9._]{2,24}$/` ou `""`.
  - `usuarioDe(u)`: `{ id: u.userId ?? u.uniqueId, arroba: u.uniqueId, nome: u.nickname || u.uniqueId, foto }`, onde `foto` = primeira URL de `u.profilePicture?.url ?? u.profilePicture?.urlList ?? u.avatarThumb?.urlList ?? u.avatarThumb?.url`, ou `null`.
  - `deChat(d)` → comentário; `deGift(d)` → presente bruto (Task 5) com `nome = d.giftDetails?.giftName ?? d.extendedGiftInfo?.name ?? d.gift?.name ?? 'presente'`, `quantidade = d.repeatCount || 1`, `diamantes = d.giftDetails?.diamondCount ?? d.gift?.diamondCount ?? 0`, `sequencia = (d.giftDetails?.giftType ?? d.gift?.type) === 1`, `fim = Boolean(d.repeatEnd)`; `deFollow(d)` → seguiu; `deLike(d)` → curtidas com `quantidade = d.likeCount`, `totalDaLive = d.totalLikeCount`. Dado sem `user` → `null`.
- Produces (`conexao-tiktok.js`): `criarConexao({ criarCliente, aoEvento, aoEstado })` → `{ conectar(arroba: string): void, desconectar(): Promise<void> }`.
  - `criarCliente(arroba)` padrão: `new TikTokLiveConnection(arroba, { enableExtendedGiftInfo: true, processInitialData: false })`; nos testes, um `EventEmitter` falso com `connect()`/`disconnect()`.
  - Ouve `chat`, `gift`, `follow`, `like`, `roomUser`, `streamEnd`, `disconnected`, `error` (nomes de `WebcastEvent`/`ControlEvent`).
  - Estados para `aoEstado` (spec §5): `{ estado: 'conectando' | 'no_ar' | 'sem_live' | 'reconectando' | 'terminou' | 'desligado' | 'erro', arroba, espectadores?, mensagem? }`. `UserOfflineError` → `sem_live` ("Não encontrei live ativa em @x") e nova tentativa em 30 s. Queda → `reconectando`, tentativas em 5/10/20/30 s e depois 30 s. `streamEnd` → `terminou`, sem nova tentativa. `@` inválido → `erro` "Digite um @ válido do TikTok." sem criar cliente.
  - Comentário do próprio dono (`arroba` igual) descartado.
  - **Geração:** cada `conectar`/`desconectar` incrementa um contador; eventos, estados e timers de geração antiga são ignorados/cancelados.

- [ ] **Step 1: Gravar amostras reais** — script temporário (não versionado) com o conector numa live qualquer pública, salvando um evento de cada tipo em `testes/amostras/chat.json`, `gift-sequencia.json`, `gift-fim.json`, `follow.json`, `like.json`. Se não houver live disponível, montar as amostras a partir dos tipos do pacote `tiktok-live-proto` e do README do conector, e registrar isso no commit.
- [ ] **Step 2: Testes que falham**

```js
// adaptador
test('limparArroba', () => {
  assert.equal(limparArroba('@Maria.Silva '), 'maria.silva');
  assert.equal(limparArroba('https://www.tiktok.com/@joao_fe/live'), 'joao_fe');
  assert.equal(limparArroba('a'), '');
  assert.equal(limparArroba('nome com espaço'), '');
});
test('adapta cada amostra para o formato padrão', ...) // chat, gift (sequencia/fim), follow, like; foto string ou null
test('evento sem user vira null', ...)
// conexão (cliente falso + mock.timers)
test('conecta e repassa eventos', ...)
test('offline: sem_live e tenta de novo em 30 s', ...)
test('queda: reconecta em 5, 10, 20, 30, 30 s', ...)
test('streamEnd: terminou e não reconecta', ...)
test('trocar de @ descarta eventos da conexão antiga', ...)
test('comentário do dono é ignorado', ...)
test('@ inválido: erro sem criar cliente', ...)
```

- [ ] **Step 3: Rodar** → FAIL · **Step 4: Implementar** · **Step 5: Rodar** → PASS · **Step 6: Commit** — `feat: conexão com a live do TikTok`

---

### Task 10: Simulador

**Files:**
- Create: `src/nucleo/simulador.js`
- Test: `testes/simulador.test.js`

**Interfaces:**
- Produces: `criarSimulador({ aoEvento, aleatorio = Math.random })` → `{ comentario(), presente(), seguidor(), curtidas(n = 500) }`. Usuários de teste com `id` `teste-N` e `foto: null`. `comentario()` sorteia de uma lista com textos de temas variados (ansiedade, família, gratidão, "boa noite", "🙏🙏") e usuários diferentes. `presente()` emite 10 presentes brutos `{ nome: 'Rosa', sequencia: true, fim: false, quantidade: 1..10 }` e um final `fim: true, quantidade: 10` (passa pelo mesmo `criarCombos` da live). `curtidas(n)` emite `{ tipo: 'curtidas', quantidade: n }`.

- [ ] **Step 1: Testes que falham** — cada método emite eventos no formato padrão/bruto esperado; `presente()` emite 11 brutos com o último `fim: true`.
- [ ] **Step 2–5:** FAIL → implementar → PASS → commit `feat: simulador para testes`

---

### Task 11: App Electron — processo principal, preload e janela de controle

**Files:**
- Create: `src/main.js`, `src/preload.cjs`, `src/logs.js`, `src/controle/index.html`, `src/controle/controle.js`, `src/controle/controle.css`, `src/tela/index.html` (vazio por enquanto, só `<div id="raiz">`)
- Test: `testes/logs.test.js`

**Interfaces:**
- Consumes: todos os módulos do núcleo.
- Produces:
  - `criarLog(pasta: string, { agora = Date.now } = {})` → `{ info(texto), erro(texto, e?) }`; arquivo `AAAA-MM-DD.log`; na criação apaga `.log` com mais de 7 dias.
  - `window.vl` (preload, `contextBridge`) — controle: `conectar(arroba)`, `desconectar()`, `config.ler()`, `config.salvar(mudancas)`, `testar('comentario'|'presente'|'seguidor'|'curtidas')`, `abrirPastaDados()`, `abrirLogs()`, `aoEstado(cb)`, `aoRegistro(cb)`, `aoFila(cb)`, `aoAviso(cb)`; tela: `aoMostrar(cb)`. Canais IPC com os mesmos nomes (`vl:conectar`, …).
- Ligação em `main.js`: conexão e simulador → presentes brutos em `criarCombos` → `diretor.receber`; demais eventos direto no diretor. `diretor.mostrar` → canal `cartao`/`faixa`/`curtidas` para a tela, `registro` e `fila` para o controle (manter os últimos 50 registros). Ao conectar: `diretor.reiniciar()`. Dados do usuário: na primeira execução copia `dados/versiculos.json` e `dados/bloqueadas.txt` para `app.getPath('userData')/dados/` e passa a ler de lá. `versiculos.json` inválido → `aoAviso` com o `erro` de `validarDados` e usa `EXEMPLO`. Erros não tratados → log + `aoEstado({estado:'erro'})`. `contextIsolation: true`, `nodeIntegration: false`, instância única (`requestSingleInstanceLock`).
- Janela de controle (spec §8.1): campo do @ + botão Conectar/Desconectar; linha de status com bolinha colorida por estado e espectadores; 4 ajustes numéricos salvos ao mudar (`change`); 4 botões de teste; lista de eventos; botões "Abrir pasta de dados" e "Abrir logs". Visual escuro simples.

- [ ] **Step 1: Teste que falha para `logs.js`** — grava linha com hora; apaga log de 8 dias atrás e mantém o de 6.
- [ ] **Step 2: Rodar** → FAIL · **Step 3: Implementar `logs.js`** · **Step 4: Rodar** → PASS
- [ ] **Step 5: Implementar `main.js`, `preload.cjs` e a janela de controle**
- [ ] **Step 6: Verificar** — `npm start`: abre controle e tela; "Testar comentário" adiciona linha na lista; conectar com `@` inválido mostra "Digite um @ válido do TikTok."; conectar com um @ que não está ao vivo mostra "Não encontrei live ativa em @…". Fechar o controle fecha o app.
- [ ] **Step 7: Commit** — `feat: app Electron e janela de controle`

---

### Task 12: Janela da tela (estilo Luz celestial)

**Files:**
- Modify: `src/tela/index.html`
- Create: `src/tela/tela.js`, `src/tela/tela.css`
- Modify: `src/main.js` (opções da janela da tela)

**Interfaces:**
- Consumes: `window.vl.aoMostrar(cb)` (Task 11) com as mensagens do diretor (Task 8).
- Janela: `width 540, height 960`, `setAspectRatio(9/16)`, `title 'Versículo Live — Tela'` (página com `<title>` igual, para não ser trocado), `autoHideMenuBar`, `backgroundThrottling: false`.
- Visual (spec §8.2 e mockup aprovado): fundo `linear-gradient(180deg,#0b1030 0%,#1b2a6b 55%,#3b4fa8 100%)`; barra de curtidas no topo (rosa→dourado `#ff8fb1`→`#ffd27a`) com `total / meta`; cartão central de vidro (`rgba(255,255,255,.08)`, borda `rgba(255,255,255,.18)`, raio 14px, `backdrop-filter: blur`); versículo em fonte serifada (Georgia); presente com borda `#ffd27a`, brilho dourado, selo `🌹 {quantidade} {nome} · obrigado!`, foto maior e partículas de luz (canvas ou divs animadas, sem bibliotecas); faixa de seguidor no topo `✨ @x chegou à família!` + versículo curto; meta em tela cheia `❤ META DE {meta} CURTIDAS!` + versículo + "versículo da comunidade", com explosão de luz; linha "a seguir: @a · @b · +N" discreta no rodapé. Entrada: sobe e aparece (≈400 ms); saída: esmaece (≈300 ms). Foto ausente ou com erro → círculo com a inicial. Versículo longo: reduzir fonte em passos até caber no cartão (mínimo 14px). Tudo em `px` relativos ao tamanho da janela (`vh`), para escalar quando redimensionada.

- [ ] **Step 1: Implementar a tela**
- [ ] **Step 2: Verificar pelo modo de teste** — com `npm start`, conferir e registrar em screenshots: comentário; presente interrompendo comentário e o comentário voltando; faixa de seguidor sobre o cartão; "+500 curtidas" duas vezes → meta em tela cheia e barra recomeçando; @ de 30 caracteres cortado; versículo longo cabendo; janela redimensionada mantendo 9:16.
- [ ] **Step 3: Verificar captura** — no TikTok LIVE Studio, adicionar fonte de captura de janela e achar "Versículo Live — Tela" (usuário confirma).
- [ ] **Step 4: Commit** — `feat: tela da live no estilo Luz celestial`

---

### Task 13: Conteúdo dos versículos

**Files:**
- Modify: `dados/versiculos.json`

- [ ] **Step 1: Escolher a tradução** — pesquisar uma edição de Almeida em domínio público disponível em texto, com a fonte e a justificativa do domínio público. **Parar e confirmar com o usuário** antes de seguir.
- [ ] **Step 2: Preencher** os temas da spec §7 — ansiedade, medo, familia, cura, tristeza, gratidao, fe, perdao, provisao, forca, paz, salvacao (10–15 versículos cada, com 8–15 palavras-chave cada, incluindo variações de gênero/número) + `geral` (≥ 30), `boas-vindas` (≥ 10, até ~120 caracteres), `comunidade` (≥ 10). Campo `traducao` com o nome da edição.
- [ ] **Step 3: Verificar** — `node -e "import('./src/nucleo/versiculos.js').then(async m => { const d = JSON.parse(await (await import('node:fs/promises')).readFile('dados/versiculos.json','utf8')); console.log(m.validarDados(d)) })"` → `{ ok: true }`; e `npm test` → PASS.
- [ ] **Step 4: Commit** — `feat: versículos por tema`

---

### Task 14: Atalho e verificação final

**Files:**
- Create: `iniciar.vbs` (abre `npm start` sem janela de terminal), `icone.ico`
- Create: `LEIA-ME.md` (como abrir, onde editar versículos/bloqueadas, como capturar no LIVE Studio)

- [ ] **Step 1: Criar `iniciar.vbs`, ícone e o atalho "Versículo Live" na área de trabalho** (`WScript.Shell.CreateShortcut`, alvo `wscript.exe "…\iniciar.vbs"`, ícone `icone.ico`).
- [ ] **Step 2: Verificar** — `npm test` → todos PASS; atalho abre o app sem terminal; percorrer de novo a lista da Task 12 Step 2.
- [ ] **Step 3: Commit** — `chore: atalho e leia-me`
- [ ] **Step 4: Aceitação** — usuário faz uma live curta real e relata o resultado.
