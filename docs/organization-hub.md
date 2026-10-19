# Central de gerenciamento — 18/10/2026

Atualização posterior nesta data: Preferências agora é funcional e Integrantes
possui listagem/exclusão mínima para Organizador. Jogadores também veem a entrada
da central no menu. Os trechos abaixo sobre placeholders, menu oculto e ausência
de endpoints descrevem a entrega anterior e estão superados por
[Preferências e exclusão](../../docs/implementacao-preferencias.md).
Os testes de navegação foram ajustados aos novos destinos; a execução visual desta
extensão foi bloqueada pelo ambiente e não herda os resultados visuais anteriores.

Fonte: pedido atual de implementação de `/org`, AGENTS.md, livros de regras e
modelos e protótipo de alta fidelidade, página 15. Branch `feat/organization-hub`;
nenhum merge, push ou deploy nesta etapa. Backend e arquivos de referência intactos.

## Referências e escopo

Foram consultados os commits de todas as branches, reflogs e objetos Git locais
inalcançáveis. Não foi encontrada uma central anterior recuperável no histórico.
O antigo placeholder de Estatísticas está em `643d874`, no arquivo então chamado
`src/features/events/components/stats-screen.tsx`, e orientou o estado “Em breve”.
Nenhum arquivo foi restaurado desse commit; Estatísticas continua funcional.

A página 15 apresenta Eventos, Súmulas, Integrantes e Preferências em duas colunas,
com Sair da Conta centralizado abaixo. Foram reutilizados os ícones de campo,
apito, jogador, ajustes e saída das bibliotecas já instaladas, com cores/gradientes
locais e tokens de tipografia, raios, sombras e foco existentes. O ícone de ajustes
recebe o círculo e a orientação horizontal da referência. O header e a navegação
atuais foram preservados, incluindo a navegação lateral em telas maiores.

Cards permanecem centralizados com menos acessos por perfil; nomes e áreas de toque
são acessíveis. A central usa a largura disponível para o título não quebrar a
palavra “Gerenciamento” em 320px. Telas baixas mantêm rolagem interna do shell;
safe areas, altura de viewport e ausência de overflow externo vêm do AppShell.

## Rotas, sessão e permissões

| Role          | Acessos na central                                          |
| ------------- | ----------------------------------------------------------- |
| Jogador       | Preferências e Sair da Conta                                |
| Administrador | Eventos, Súmulas, Preferências e Sair da Conta              |
| Organizador   | Eventos, Súmulas, Integrantes, Preferências e Sair da Conta |

- Eventos aponta a `/org/events`. O acesso existente do ADMIN ao catálogo/times
  foi preservado; criar/editar/gerenciar eventos continua exclusivo do ORGANIZER
  nos fluxos e Services existentes (RN03, RN05–RN08 e RN59).
- Súmulas aponta a `/org/matches`, preservando ADMIN/ORGANIZER (RN38).
- `/org/members` é somente ORGANIZER e mostra apenas “Em breve” e retorno à central.
  ADMIN/PLAYER recebem a mensagem de permissão insuficiente por acesso direto.
  Não há listagem, cadastro, mudança de role, endpoint ou implementação RN56–RN59.
- `/org/preferences` mostra somente “Em breve” e retorno à central para usuários
  autenticados. Jogador acessar a central apenas para Preferências/Sair segue a
  orientação explícita anterior do usuário nesta conversa. O menu Gerenciar
  continua oculto para PLAYER, preservando sua visibilidade atual nas outras telas.
- Reutilizados `useAuth`, `GlobalAccessLoading` e logout existente. Sem sessão,
  redireciona à entrada; verificação/erro não renderizam acessos administrativos.
  Os placeholders não consultam dados nem criam operações administrativas.
- `src/proxy.ts` encaminha somente o caminho exato `/ORG` para `/org` com 308,
  preservando query string e evitando loop em `/org`. Uma segunda pasta `ORG`
  não foi criada, evitando colisão com `org` no filesystem Windows.
- O link Gerenciar do AppShell aponta a `/org`, mantendo aria-current pelo contexto.
  O retorno genérico do catálogo de súmulas agora vai à central. Retornos específicos
  de evento/súmula/detalhe e returnTo dos fluxos de eventos não foram alterados.

O filtro visual não substitui autorização. Nenhuma permissão no backend mudou,
nenhuma entidade/contrato/regra nova foi criada. Integrantes e Preferências são
deliberadamente placeholders, sem antecipar funcionalidades futuras.

## Arquivos

- Rotas `app/org/page.tsx`, `app/org/members/page.tsx`, `app/org/preferences/page.tsx`.
- `features/organization/organization.access.ts`, `components/organization-screen.tsx`
  e CSS Module próximo ao componente.
- AppShell: destino Gerenciar e classe opcional do título, usada apenas pela central.
- MatchesScreen: somente destino do retorno genérico do catálogo.
- Proxy de canonicalização, testes de organização e script Playwright; script novo
  `npm run test:organization:browser`. Sem dependência adicionada.

## Verificações

- `npm run typecheck`, build Next com `NEXT_BUILD_WORKER_THREADS=true` e política
  de código (`node scripts/lint.mjs`) passaram.
- `npm test`: 51 testes passaram, incluindo 2 de hierarquia/apresentação e
  canonicalização sem loop. Os 49 testes anteriores continuam passando.
- API sem alterações: `npm run test:events` passou 18 casos, incluindo HTTP real
  com persistência simulada; `node scripts/matches.test.mjs` passou 8, conferindo
  permissões e invariantes existentes. Build/tipos da API também passaram.
- Playwright: Next e Chromium reais, API/sessão interceptadas com fixtures sem contas
  reais ou acesso ao banco. Três roles em 320×740, 390×844, 768×1024, 1440×900 e
  844×390 (15 combinações). Canonicalização também conferida por HTTP real do Next.
  Navegação de ida/volta, links, ativo do menu, acessos diretos, abertura do formulário
  existente de criação de súmula, placeholders, preservação da tela de estatísticas,
  teclado/Enter/foco, logout único, loading/erro/retry, centralização e overflow.
  Teste verifica que a central não pede dados administrativos e que placeholders
  não chamam endpoints de integrantes/preferências nem fazem mutações.
- Capturas em `.test-build/organization-browser/`, revisadas em mobile e desktop
  contra a composição da página 15. Primeira revisão identificou quebra indesejada
  do título em 320px, corrigida e incluída na asserção do roteiro. A expectativa
  inicial de criar súmula na listagem por evento foi corrigida: a ação existente é
  validada no catálogo, sem modificar a aplicação para acomodar o teste.
- `npm run lint` completo: política passou; Prettier geral apontou 50 arquivos
  preexistentes não alterados. Arquivos alterados verificados separadamente; não
  foi aplicada formatação em massa nem alterada a implementação de Estatísticas.

Não houve teste em dispositivo físico, Safari/iOS, autenticação real ou persistência
real nesta etapa visual. As fixtures de navegador não comprovam autorização em
produção; as regressões da API verificam seus Services/HTTP com repositórios de teste.
Não há configuração, migração ou decisão de negócio pendente para esta entrega.

## Complemento de navegação — 18/10/2026

Pedido posterior substituiu os retornos textuais das páginas da central e dos
fluxos gerenciados por setas no título. O atalho de Súmulas no catálogo de eventos
foi removido; o card da central permanece. Detalhes, exceção dos fluxos de
autenticação e validações estão em [back-navigation.md](back-navigation.md).
