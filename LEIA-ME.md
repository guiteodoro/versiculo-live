# Versículo Live

App que acompanha a sua live no TikTok e mostra versículos numa tela vertical (9:16), pronta para capturar no TikTok LIVE Studio.

## Como abrir

Dê dois cliques no atalho **Versículo Live** na área de trabalho. Abre sem janela preta de terminal.
Se o atalho sumir, rode `criar-atalho.ps1` (botão direito > Executar com o PowerShell) na pasta do projeto.

## Primeiro uso

1. Digite o seu @ do TikTok (a conta que vai fazer a live) no campo indicado.
2. Clique em **Conectar** (com a live já no ar).
3. Use os botões de **teste** (comentário, presente, seguidor, curtidas) para ver a tela reagindo, sem precisar de ninguém na live.

## Mostrar na live (TikTok LIVE Studio)

O app abre uma segunda janela chamada **Versículo Live — Tela**. No TikTok LIVE Studio, adicione uma fonte do tipo **Captura de janela** e escolha essa janela. Deixe-a aberta (pode ficar atrás de outras).

## Editar versículos e palavras bloqueadas

Clique em **Abrir pasta de dados**. Os arquivos ficam em `%APPDATA%\versiculo-live\dados`:

- `versiculos.json`: os versículos exibidos.
- `bloqueadas.txt`: palavras que não devem aparecer (uma por linha).

Depois de editar, clique em **Conectar** de novo para recarregar.

## Logs

Ficam em `%APPDATA%\versiculo-live\logs`. Se algo der errado, olhe o arquivo mais recente.

## Sobre presentes

O app **agradece** os presentes recebidos. Não prometa bênçãos, milagres ou resultados em troca de presentes.

## Para reinstalar

Na pasta do projeto, rode `npm install`. Precisa do **Node.js 22.12 ou mais novo** (esta máquina tem o 20.18; a instalação atual foi feita com um contorno).

A conexão com o TikTok usa uma biblioteca **não oficial**; ela pode parar de funcionar quando o TikTok mudar algo. Se isso acontecer, o app avisa e é preciso atualizar a biblioteca.
