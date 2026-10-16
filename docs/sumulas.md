# Súmulas — implementação e continuidade

Fonte: pedido de implementação e esclarecimentos posteriores de 16/10/2026 nesta
conversa. Referências: AGENTS.md, livros de regras/modelos e protótipo, páginas
26–30. O PDF e seus recursos foram preservados. A decisão posterior que volta a
admitir pendências está registrada na seção 20 do livro de regras.

## Fluxo e integração

- Administradores e Organizadores acessam Súmulas pela listagem de eventos de
  gerenciamento. Jogadores recebem recusa nas páginas e na API.
- `/org/matches`: eventos ACTIVE, busca, cards em carrossel, paginação discreta,
  Criar súmula e Súmulas ativas. Reservas e times incompletos não são selecionáveis.
- Criar abre a súmula pendente em `/org/matches/:eventId/:matchId`. **Iniciar**
  dispara a transição, registra horário/escalação e inicia o cronômetro. Pendentes
  podem ser excluídas com confirmação; iniciadas não podem ser apagadas.
- A página mostra placar, equipes e jogadores, gols e assistências. Gols comuns
  podem ser registrados, corrigidos e excluídos enquanto em andamento. O assistente
  é outro participante da escalação do mesmo time; pode ser removido na correção.
- Gol contra possui botão próprio e seleciona somente o time beneficiado. Não
  possui autoria ou assistência individual. Mantém-se o registro em Match.goals[].
- Duração mínima de 3 minutos inteiros; valores maiores são permitidos. Minuto do
  gol é tempo decorrido; após zerar, o formulário oferece 0. Correções permitem
  minutos já transcorridos dentro da duração. Cronômetro não encerra partidas.
- **Finalizar súmula** exige confirmação e pode ser usado antes de zerar. Após
  sucesso, a interface volta à lista ativa. Consulta direta à finalizada recebe
  404 e não oferece edição. A API mantém os registros para projeções estatísticas.
- Nenhuma pendente ou em andamento pode coexistir com nova criação. Ambas bloqueiam
  cancelamento/finalização do evento. A API revalida tudo transacionalmente.

## Arquivos e padrões

`src/features/matches` reúne transporte/validação, contratos, cronômetro e
componentes com CSS Module local. Rotas ficam em `src/app/org/matches`.
`events-screen.tsx` acrescenta o acesso à funcionalidade, sem novo hub de
organização, contas ou páginas independentes de estatísticas.

Reutilizados AppShell, Carousel, Modal, tokens, campos e o transporte autenticado
com cookies/CSRF. O input permanece sem borda; o contêiner recebe borda neutra e
fundo de foco. O shell tem rolagem interna. O loading de sessão permanece global;
consultas e operações da súmula têm feedback local e bloqueio de duplo envio.
Falhas de conflito retiram o formulário desatualizado e atualizam os registros,
pedindo conferência antes de um novo envio; não repetem operações incertas.

O tempo é calculado a partir de startedAt e Date.now. O intervalo só repinta a
tela; visibilitychange, focus e pageshow atualizam ao voltar do segundo plano.
Em 00:00 a partida permanece IN_PROGRESS até confirmação de encerramento.

## Adaptações do protótipo

Mantidos catálogo, modal de times/duração, acesso ativo com apito, resumo de
placar/tempo e cards de equipes/jogadores. O botão Iniciar foi mantido conforme a
última decisão, substituindo a exigência anterior de início ao criar. O comando
final se chama Finalizar súmula e exige confirmação. Campos e controles de
correção/exclusão e gol contra foram acrescentados nos mesmos padrões de cards,
campos e modais para cumprir as decisões posteriores. O header atualizado não
foi substituído pelo header antigo do PDF.

## Testes e reprodução

- `npm test`: inclui regressão de relógio por horário do sistema e minuto do gol.
- `npm run typecheck`, `npm run build` e `node scripts/lint.mjs` verificam o código.
- `npm run test:matches:browser`: requer build atual de frontend/API e
  `MATCHES_LOCAL_TEST=true`. Usa banco local exclusivamente em
  `127.0.0.1:27188/patotafut_matches_test`, replica set patotafutTest; não aceita
  URI de produção, não carrega uma URI do .env e não intercepta APIs.
- Script inicia Next isolado em localhost:3101 e Express em porta efêmera,
  autentica usuários de teste e encerra esses processos ao terminar. Requer
  Chromium do Playwright. Capturas em `.test-build/matches-browser/`.
- Matriz: PLAYER/ADMIN/ORGANIZER em 390×844, 768×1024 e 1440×900; recusa de acessos
  diretos/CSRF, criação pendente, exclusão, início, gols/assistências, correção,
  exclusão, gol contra, cronômetro zerado, confirmação e ausência de acesso final.

Resultados finais são registrados na continuidade da API após execução. Ainda
não foi utilizado dispositivo físico. O teste do relógio em navegador usa relógio
controlado; não comprova todas as políticas de suspensão de sistemas móveis.
RN61 versus RN96 continua pendente. Rankings e gerenciamento de contas permanecem
fora do escopo; estatísticas derivadas não têm coleção ou placar independente.

## Ajuste visual dos times e botões — 16/10/2026

Fonte: pedido posterior do usuário, limitado à apresentação. Nenhuma regra,
permissão, estado, ação, modelagem ou contrato foi alterado. Os botões Iniciar,
Excluir súmula pendente e Gol contra já existiam; não foram criados fluxos novos.

- Iniciar usa os tokens/classes compartilhados de fundo verde e texto branco;
  Excluir súmula pendente usa vermelho/branco; Gol contra usa amarelo/branco.
  Mantidos foco, hover e opacidade desabilitada; pressionamento usa brilho reduzido.
- MatchTeams concentra a apresentação das duas equipes e recebe o mesmo callback
  de registro de gol. Nome fica à esquerda; gols e bola compartilham um grupo
  alinhado à direita, com gap pequeno. Nomes longos quebram sem sobreposição.
- Reutilizado o Carousel existente, sem adicionar biblioteca. A opção visual
  pairOnDesktop permite arrastar, setas, indicadores e ArrowLeft/ArrowRight abaixo
  de 1024 px; a partir dessa largura o mesmo DOM mostra duas colunas, sem controles
  ou semântica de carrossel. Os demais usos mantêm a apresentação anterior.
- Componentes e estilos: matches-screen.tsx, match-teams.tsx, matches.module.css,
  carousel.tsx e events.module.css. O ajuste compartilhado de CSS fica restrito à
  opção nova; header, navegação e estilo base dos cards foram preservados.

Validação: Playwright em 320×740, 390×844, 768×1024, 1024×768 e 1440×900, com API
simulada e nenhuma escrita. Conferidos gesto de toque sintetizado via Chromium,
setas/indicadores, Enter e teclado direcional, permanência dos nós dos times,
abertura do formulário para o jogador do time B, alinhamento, nomes longos com e
sem espaços, ausência de overflow externo, cores, foco e estados visuais. Também
conferido o carrossel padrão do catálogo no desktop. Capturas inspecionadas em
`.test-build/matches-visual/`. Não foi utilizado celular físico; a imagem mencionada
no pedido não estava disponível, portanto foram seguidas as especificações textuais
e a referência já existente, sem redesenhar a tela.

Build, typecheck, política de código, 46 testes unitários e Prettier dos arquivos
envolvidos passaram. Script: `node scripts/matches-visual.test.mjs`, após build.
Esse script inicia e fecha seu próprio servidor Next na porta 3102 e não acessa
backend ou banco real. A validação é visual, não uma nova comprovação de persistência.
