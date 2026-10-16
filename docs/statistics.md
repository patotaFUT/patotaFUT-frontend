# Estatísticas — implementação e validação

Fonte: RN100–RN110 e complementos dos livros do projeto, pedido de implementação e
respostas posteriores do usuário em 16/10/2026. Branch `feat/statistics`, API em
`feature/statistics`. Sem merge/deploy. Os livros e o PDF foram preservados.

## Organização e integrações

`/stats` usa `features/statistics`: contratos validados em runtime, cliente de leitura
com o transporte protegido existente, componentes e CSS Modules. Reutiliza AppShell,
Modal e DateInput; preserva o loading global de acesso e mostra loading local nos
rankings. Não há novo estado global nem dependência adicionada.

- `GET /statistics`: período civil inclusivo opcional (`from`, `to`), padrão mês atual
  no fuso do projeto. Retorna período, finishedMatchCount e rankings `scorers` e
  `assistants`, apenas com identificação pública, totais e posição. Disponível a
  PLAYER, ADMIN e ORGANIZER autenticados.
- A busca da tela filtra nome/sobrenome nos rankings completos já recebidos, sem
  recalcular posições. A API também admite `search`, aplicando o filtro após classificar.
- O modal existente de finalização usa `GET /events/:eventId/highlights`, restrito a
  ORGANIZER pelo Service, e envia a revisão da prévia na confirmação de status.
  Mudanças concorrentes exigem revisar a prévia; não se repete a mutação automaticamente.
  Confirmação, autorização e bloqueios de súmula pendente/em andamento permanecem na API.
- Súmulas finalizadas continuam inacessíveis separadamente. A tela não cria links
  para detalhes de partidas finalizadas nem recebe registros individuais dos gols.

## Decisões e apresentação

Classificação por quantidades cruzadas e timestamp completo, com posições densas
(`1, 1, 2`), conforme resposta explícita. Se faltar histórico de alguém no grupo com
os mesmos totais, todo o grupo compartilha posição. Zero na categoria compartilha
posição e não recebe pódio. Todos os primeiros com pontuação positiva aparecem nos
destaques; sem pontuação, “Sem artilheiro”/“Sem assistente”.

Referência: PDF páginas 13–14 e 25. Mantidos card branco, abas verdes, linhas
arredondadas, bola/calçado, cores do pódio e shell atualizado. Adaptações: posição
explícita, todos os vencedores empatados, quebra de nomes longos, controles acessíveis
de toque/teclado e ampliação do card no desktop. O modal se chama “Finalizar evento”
porque a operação ainda aguarda confirmação. O título e a navegação existentes
acomodam a apresentação responsiva sem overflow externo.

## Verificações

- Typecheck, build Next com workerThreads e política de código passaram.
- `npm test`: 49 testes passaram, incluindo contratos, transporte, busca mantendo
  posição e proxy do namespace agregado.
- `MATCHES_LOCAL_TEST=true` e `npm run test:statistics:browser`: Playwright com Next,
  Express e MongoDB locais, 3 roles × 3 tamanhos (390×844, 768×1024, 1440×900).
  Navegação, abas por teclado, período/máscara/datas inválidas, busca, ausência de
  resultados/partidas, permissões, destaques compartilhados/ausentes, confirmação,
  imutabilidade e bloqueios. Capturas revisadas e ausência de overflow verificada.
  Tablet em Pacific/Kiritimati também confere o marcador civil sem deslocamento.
- Somente atraso e erro do GET de estatísticas são simulados por interceptação HTTP
  para verificar loading/erro/retry. Os fluxos de sucesso e finalização usam persistência
  real. O empate exato da fixture usa relógio controlado no Service do servidor.
- `npm run lint`: política passou; Prettier geral apontou 38 arquivos preexistentes
  não alterados. Não foi aplicada formatação em massa; arquivos alterados foram
  verificados separadamente.
- Não houve teste em dispositivo físico, Safari/iOS ou teclado nativo real.

Não há migração/backfill nem variável nova de produção. A API deve oferecer os
endpoints compatíveis; permanece API_URL apenas no servidor Next. A política RN61
continua fora do escopo. Detalhes de testes reais e rastreabilidade estão em
`patotaFUT-API/docs/continuity-statistics.md` no workspace do projeto.
