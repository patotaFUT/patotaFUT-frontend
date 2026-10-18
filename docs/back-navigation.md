# Retornos no título e acesso às súmulas — 18/10/2026

Fonte: pedido mais recente do usuário nesta conversa. Alteração somente visual/de
navegação na branch `feat/organization-hub`, preservando o trabalho local da central.
AGENTS.md e livros foram consultados; nenhuma RN, entidade, contrato, permissão,
operação de negócio ou arquivo de referência foi alterado. Sem merge ou push.

## Controles e destinos

AppShell agora aceita o destino explícito de retorno e renderiza um Link com
FiArrowLeft, nome acessível “Voltar”, alvo de toque de 44px e foco visível. O controle
fica na coluna esquerda do título; o atualizar permanece à direita. Colunas laterais
equivalentes mantêm o título centrado quando falta um controle. O foco é desenhado
dentro do botão para não ser cortado pela área de rolagem no celular.

| Tela                                | Retorno no título                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `/org/events`                       | `/org`                                                                                    |
| `/events/:eventId` (Jogador)        | returnTo validado ou `/events`                                                            |
| `/org/events/:eventId`              | returnTo validado ou `/org/events`                                                        |
| `/org/events/:eventId/teams`        | returnTo validado; sem ele, gerenciamento do evento para ORGANIZER ou catálogo para ADMIN |
| `/org/events/:eventId/teams/edit`   | mesma URL de times/contexto anteriormente usada pelo botão abaixo da formação             |
| `/org/matches`                      | `/org`                                                                                    |
| `/org/matches/:eventId`             | `/org/matches`                                                                            |
| `/org/matches/:eventId/:matchId`    | `/org/matches/:eventId`                                                                   |
| `/org/members` e `/org/preferences` | `/org`, inclusive o retorno já existente em permissão insuficiente de Integrantes         |

- Removidos os retornos textuais abaixo dos conteúdos das telas acima. Na edição
  de times, Confirmar troca permanece, centralizado; o bloqueio de retorno enquanto
  a operação está ocupada foi preservado no controle do título.
- `/events`, `/stats` e a central `/org` continuam sem retorno no título: não há
  destino anterior obrigatório definido nesses pontos de entrada.
- Recuperação de senha mantém seu link textual “Voltar ao login”, inclusive o
  fluxo próprio de autenticação. Esse layout de marca/título não utiliza o cabeçalho
  de três posições do AppShell; não foi forçada uma adaptação. Login e cadastro
  mantêm seus links existentes. Cancelar, Fechar, usar outro e-mail e outras ações
  de formulário/modal não foram convertidos em navegação de retorno.
- `eventBackHref`, junto do sanitizador existente, centraliza exatamente os
  destinos anteriores de eventos/times. Mantidos returnTo aninhado, busca, filtro,
  página, slide e scroll. Sem router.back ou dependência do histórico; destinos
  externos continuam recusados. O redirecionamento existente de ADMIN/ORGANIZER
  da visão pública de times permanece intacto.
- Removido somente o atalho Súmulas do conteúdo de `/org/events`. O card Súmulas
  em `/org`, `/org/matches` e suas permissões/ações existentes foram preservados.

## Verificações executadas

- Build Next, incluindo tipos, passou; `npm test`: 52 testes passaram, com novo
  caso cobrindo fallback por role, entrada direta, contexto aninhado e URL externa.
- Playwright `node scripts/back-navigation.test.mjs`: 12 combinações de
  PLAYER/ADMIN/ORGANIZER × 320×740, 390×844, 768×1024 e 1440×900. Entrada direta,
  retornos via Enter/clique, contexto de edição → times → gerenciamento → catálogo,
  preservação da busca, fallbacks seguros, três níveis de súmulas, ausência do
  atalho removido, permanência de Atualizar, layout/foco/44px e ausência de overflow.
  Recuperação mantém o link original, e pontos de entrada não ganham seta.
- Regressão `node scripts/organization-browser.test.mjs`: 15 combinações, incluindo
  844×390 em paisagem. Central, roles, navegação, placeholders, logout, sessão e
  estados de loading/erro/retry passaram com os novos controles. O card de Súmulas
  e a abertura do formulário existente continuam funcionando.
- Ambos usam Next e Chromium reais com APIs/sessões interceptadas. Não houve acesso
  a produção nem gravação em banco; isso não é comprovação de persistência real.
  As rotas de aplicação e redirecionamentos são reais. Capturas em
  `.test-build/back-navigation/` e `.test-build/organization-browser/`, revisadas.
- Política de código passou. O lint completo aponta formatação em 47 arquivos
  preexistentes não alterados; arquivos envolvidos verificados separadamente com
  Prettier e git diff --check. Não foi feita formatação em massa.

O build e a matriz de retornos foram repetidos após ajustar o foco mobile para
evitar contorno cortado pela borda. Sem teste em aparelho físico/Safari/iOS. A imagem
mencionada no pedido não estava disponível nesta sessão; foi aplicada a composição
textual fornecida, conferida pelas capturas e pelas posições dos controles.

Script adicional: `npm run test:back-navigation:browser` após build local, sem
configuração ou dependência nova. Nenhum teste usa credenciais reais. Backend,
estatísticas, campos, cabeçalho da marca e regras RN03/RN07/RN38 permanecem inalterados.
