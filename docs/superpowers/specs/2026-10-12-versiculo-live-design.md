# Versículo Live — Especificação

**Data:** 12/10/2026
**Status:** aguardando revisão
**Uso:** pessoal (um único usuário, um PC com Windows 11)

## 1. Objetivo

Um app de desktop que entra na live do TikTok do usuário e mostra, numa janela
vertical 9:16 capturada pelo TikTok LIVE Studio, o @ de quem interage com um
versículo da Bíblia. Inspirado no funcionamento do Kyrat Games Launcher (Electron
+ conexão não oficial com a live), mas com código, nome e visual próprios.

**Sucesso:** numa live real, cada pessoa que comenta recebe um versículo coerente
com o que escreveu, quem manda presente é agradecido em destaque na hora, e a tela
nunca trava nem fica minutos atrasada em relação ao chat.

### Princípio sobre presentes

O app **reconhece** presentes, não os **vende**. Todo comentário recebe um
versículo sem custo; o presente só ganha prioridade e destaque visual. Nenhum texto
na tela associa presente a bênção, oração ou favor espiritual, nem condiciona a
live a metas de presentes. (As Diretrizes de Monetização do TikTok LIVE devem ser
lidas pelo usuário; o app não garante a interpretação do TikTok.)

## 2. Fora do escopo (versão 1)

Login, loja, pagamentos, afiliados, instalador, atualização automática,
outras plataformas (YouTube/Twitch), sons, estatísticas, distribuição a terceiros.

## 3. Tecnologia

- **Electron** (versão estável atual) com HTML/CSS/JavaScript puros, sem framework
  de interface e sem empacotador. Roda com `npm start`; um atalho na área de
  trabalho chama esse comando.
- **tiktok-live-connector** (npm) para ler a live. É **não oficial**: pode quebrar
  quando o TikTok mudar algo. A API exata (nomes de eventos/campos) é conferida na
  versão instalada durante a implementação.
- **node:test** para os testes automáticos (sem dependências extras).
- A lógica (pasta `src/nucleo/`) é JavaScript puro, sem Electron, para poder ser
  testada direto no Node.

## 4. Estrutura de pastas

```
Versiculo Live/
  package.json
  src/
    main.js                 processo principal: janelas, IPC, liga as peças
    preload.js              ponte segura entre janelas e processo principal
    nucleo/                 lógica pura, testável
      eventos.js            formato padrão dos eventos
      conexao-tiktok.js     adapta o tiktok-live-connector para o formato padrão
      simulador.js          gera eventos de teste no mesmo formato
      combos.js             junta sequências de presentes num evento só
      versiculos.js         escolhe o versículo pelo texto do comentário
      texto.js              normalizar, tokenizar, distância de edição
      fila.js               ordem, prioridade e tempo de espera por pessoa
      curtidas.js           soma curtidas e detecta a meta
      filtro.js             palavras bloqueadas
      config.js             ler/salvar configurações
    controle/               janela de controle (index.html, controle.js, controle.css)
    tela/                   janela da live 9:16 (index.html, tela.js, tela.css)
  dados/
    versiculos.json         temas, palavras-chave e versículos
    bloqueadas.txt          uma palavra/expressão por linha
  testes/                   um arquivo de teste por módulo do núcleo
  docs/
```

## 5. Formato padrão dos eventos

Tanto a conexão real quanto o simulador emitem só estes objetos:

```js
{ tipo: "comentario", usuario, texto }
{ tipo: "presente",   usuario, presente: { nome, quantidade, diamantes, imagem } }
{ tipo: "seguiu",     usuario }
{ tipo: "curtidas",   usuario, quantidade, totalDaLive }
// usuario = { id, arroba, nome, foto }
```

Estado da conexão (só para a janela de controle):
`desligado | conectando | no_ar(espectadores) | sem_live | reconectando | erro(mensagem)`.

## 6. Regras de comportamento

### 6.1 Comentários
- Comentários do próprio dono da live são ignorados.
- Comentário com palavra bloqueada (`filtro.js`) é ignorado. Se o **@** contiver
  palavra bloqueada, comentários e seguidas dessa pessoa são ignorados, e presentes
  dela aparecem como "@anônimo".
- **Tempo de espera por pessoa** (padrão 5 min): conta a partir do momento em que
  o comentário **entra na fila**. Comentários da mesma pessoa dentro desse tempo são
  ignorados (assim ninguém ocupa duas posições na fila).
- Entra na fila de comentários. A fila tem **máximo de 20**; se encher, o mais
  antigo sai.
- Cartão fica **8 s** na tela (ajustável).

### 6.2 Presentes
- **Combos:** presentes em sequência geram vários avisos do TikTok; `combos.js`
  espera o fim do combo e emite um único evento com a quantidade total. Se o aviso
  de fim não chegar em 5 s após o último, emite com o que tiver.
- Presentes **ignoram o tempo de espera** e vão para a fila de presentes, que tem
  prioridade total sobre a de comentários.
- Se um comentário está na tela quando chega um presente, o presente **entra na
  hora**; o comentário interrompido volta para o início da fila de comentários.
- Vários presentes seguidos: um por vez, na ordem de chegada.
- Cartão dourado fica **12 s** (ajustável), com foto maior e selo
  "🌹 10 rosas · obrigado!". Versículo do tema `gratidao`/`geral`.
- Receber presente **não zera nem estende** o tempo de espera de comentário da pessoa.

### 6.3 Seguidores
- Faixa pequena no topo por **5 s**, com "✨ @fulano chegou à família!" e um
  versículo curto do tema `boas-vindas`.
- Canal separado: não interrompe o cartão central. Máximo de 3 faixas pendentes;
  excedentes são descartadas.
- Cada pessoa gera no máximo uma faixa por sessão.

### 6.4 Curtidas
- Barra no topo com `curtidas desde a conexão / meta`. Meta padrão **1.000**.
- Ao bater a meta: assim que o cartão atual terminar, mostra o **versículo da
  comunidade** em tela cheia por **10 s** (tema `comunidade`). Depois a meta
  avança mais 1.000 (o valor configurado) e a barra recomeça.
- Presentes que chegarem durante a tela cheia esperam ela terminar.

### 6.5 Ordem geral do cartão central
1. Tela cheia da meta (se pendente e nenhum cartão em exibição)
2. Fila de presentes
3. Fila de comentários

A linha discreta "a seguir: @ana · @pedro.r · +4" mostra os próximos da fila.

## 7. Escolha do versículo

`dados/versiculos.json`:

```json
{
  "traducao": "Almeida (domínio público) — edição confirmada com o usuário",
  "temas": [
    {
      "id": "ansiedade",
      "palavras": ["ansiedade", "ansioso", "ansiosa", "preocupado", "nervoso", "angustia"],
      "versiculos": [
        { "ref": "Filipenses 4:6", "texto": "..." },
        { "ref": "1 Pedro 5:7", "texto": "..." }
      ]
    }
  ]
}
```

Temas iniciais (10–15 versículos cada): ansiedade, medo, família, cura e saúde,
tristeza, gratidão, fé, perdão, finanças e provisão, força, paz, salvação; mais os
temas especiais `geral`, `boas-vindas` (versículos curtos) e `comunidade`.

Algoritmo:
1. Normaliza o comentário: minúsculas, sem acentos, sem pontuação; separa palavras.
2. Para cada palavra, compara com as palavras-chave de cada tema: igual, ou
   distância de edição ≤ 1 se a palavra tiver 5+ letras ("ansiedad", "familia").
3. Ganha o tema com mais acertos; empate → o que aparece primeiro no arquivo.
   Sem acerto → `geral`.
4. Sorteia um versículo do tema, evitando os **10 últimos** exibidos (se o tema
   tiver menos que isso, evita o máximo possível).

**Tradução:** antes de preencher o arquivo, uma edição de Almeida em domínio
público é identificada e confirmada com o usuário. Até lá, o arquivo tem poucos
versículos de exemplo, suficientes para testes.

## 8. Janelas

### 8.1 Janela de controle (≈ 760×620)
- Campo do @ (aceita `@nome`, `nome` ou link do perfil) e botão Conectar/Desconectar.
- Status: "● No ar · 152 espectadores · fila: 6", "Não encontrei live ativa em
  @fulano", "reconectando…", ou a mensagem de erro.
- Ajustes, salvos na hora: espera por pessoa (min), tempo do comentário (s), tempo
  do presente (s), meta de curtidas.
- Botões de teste: comentário (texto aleatório de uma lista com temas variados),
  presente (simula combo de 10 rosas), seguidor, +500 curtidas.
- Lista dos últimos 50 eventos, com o versículo escolhido para cada comentário.
- Botões "Abrir pasta de dados" (para editar versículos/bloqueadas) e "Abrir logs".

### 8.2 Janela da live (9:16, padrão 540×960, redimensionável mantendo 9:16)
- Título fixo "Versículo Live — Tela" (para achar na captura do LIVE Studio).
- Sem moldura de botões; só o conteúdo. Estilo **Luz celestial**: fundo em
  degradê azul-noite → azul, cartões de vidro translúcido, presente com borda e
  brilho dourado e partículas de luz.
- Animações: cartão sobe e aparece suavemente; sai esmaecendo. Presente entra com
  brilho. Meta com explosão de luz.
- @ com mais de 22 caracteres é cortado com "…"; versículos longos reduzem a fonte
  até caber.
- Foto do perfil vem da URL do TikTok; se falhar, círculo com a inicial.

## 9. Configurações

Arquivo `config.json` na pasta de dados do usuário do Electron (`userData`):

```json
{ "arroba": "", "esperaMin": 5, "tempoComentarioS": 8, "tempoPresenteS": 12,
  "tempoSeguidorS": 5, "tempoMetaS": 10, "metaCurtidas": 1000 }
```

Valores inválidos voltam ao padrão.

## 10. Erros

| Situação | Comportamento |
|---|---|
| Usuário não está ao vivo | Status "Não encontrei live ativa em @fulano"; tenta de novo a cada 30 s até desconectar |
| Conexão cai | Status "reconectando…"; tenta com espera crescente (5, 10, 20, 30 s, depois a cada 30 s). A tela continua exibindo a fila |
| Live terminou | Status "A live terminou"; para de tentar |
| Biblioteca quebrou / erro desconhecido | Mensagem clara na janela de controle + detalhe no log. Modo de teste segue funcionando |
| `versiculos.json` inválido | Mensagem na janela de controle apontando o problema; usa os versículos de exemplo embutidos |
| Foto não carrega | Inicial do nome num círculo |

Logs em `userData/logs/` (um arquivo por dia, mantidos 7 dias).

## 11. Testes

- **Automáticos (node:test)**, um arquivo por módulo do núcleo: normalização e
  distância de edição; escolha de tema (com acento, sem acento, erro de digitação,
  empate, sem tema); não repetição dos 10 últimos; fila (prioridade, interrupção e
  retorno do comentário, limite de 20, tempo de espera, presente ignora espera);
  combos (fim normal e por tempo limite); curtidas (meta e avanço); filtro;
  config (padrões e valores inválidos); adaptação dos eventos do
  tiktok-live-connector para o formato padrão, com exemplos gravados.
- **Manuais:** pelo modo de teste, conferir cada animação e cada regra na janela da
  live antes da entrega.
- **Aceitação:** live curta real feita pelo usuário.
