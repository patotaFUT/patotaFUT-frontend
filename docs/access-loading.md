# Preparação e recuperação de acesso

Fonte: pedido do usuário de 15/10/2026. Decisão de apresentação e de tratamento de
falhas; não cria regras de negócio. Foram consultados os livros de regras e modelos,
suas notas e lacunas, e os documentos de autenticação e frontend/login na pasta
superior. RN03/RN07 e RN71–RN75 permanecem com as verificações, permissões, métodos
de autenticação e contratos existentes. Os livros e o backend não foram alterados.

## Acionamento e encerramento

`GlobalAccessLoading` usa somente o estado da restauração de sessão do `useAuth`.
Está integrado a login/cadastro, recuperação de senha, eventos/times e estatísticas.
Não existe contador de HTTP pendente, interceptor de rede ou polling.

- Na montagem da tela, aguarda `/auth/me` e, quando necessário, o único refresh já
  existente, com CSRF e nova leitura de `/auth/me`.
- Uma restauração explícita (incluindo a confirmação de sessão após rejeição 401
  tratada pela tela, aviso entre abas e o botão de tentar novamente) bloqueia o
  acesso enquanto aguarda a sessão.
- Uma sessão válida ou não autenticada encerra o loading. Sessão inválida mantém
  o redirecionamento existente das telas protegidas ao login, sem novo ciclo.
- A revalidação existente ao voltar à aba é secundária: não mostra loading nem
  substitui uma tela utilizável por um erro de comunicação. Uma resposta conclusiva
  de sessão inválida continua encerrando a sessão. Não inicia novas tentativas
  automáticas quando a preparação está em erro.
- Erros de validação, permissão e negócio em operações locais não acionam o loading.
  Eventos, filtros, presença, formulários e formação de times mantêm seu feedback.

## Limites e acessibilidade

Somente a restauração recebe 60 segundos por chamada e prazo total de 75 segundos,
incluindo espera pelo Web Lock entre abas, CSRF e refresh. O prazo total cancela o
transporte e a espera pelo lock. O proxy permite 60 segundos em `/auth/me`,
`/auth/csrf` e `/auth/refresh`; os demais endpoints continuam com 15 segundos.
Chamadas locais de CSRF e refresh continuam com os 15 segundos do cliente comum.
Infraestrutura de hospedagem pode impor um limite menor; ele resulta na mesma
mensagem de falha e tentativa manual. Não há atraso mínimo para animação.

Falha de preparação substitui a animação por uma mensagem acessível e um botão
**Tentar novamente**, sem repetição automática. Restaurações concorrentes compartilham
a mesma Promise e não duplicam chamadas. Uma tentativa posterior usa novo prazo.

O dialog modal nativo ocupa a viewport, incluindo header e navegação, fica na
camada superior do navegador e torna o conteúdo subjacente inerte para mouse,
toque e teclado. Escape não o fecha. O foco vai ao dialog durante a espera, ao
botão após falha e retorna ao elemento anterior quando ele ainda existe. CSS Module
usa tokens existentes, safe areas, 100vh/100dvh, rolagem interna, bola de 96px,
texto exato `carregando` e desliga a animação com `prefers-reduced-motion`.

## Validação e revisão

Branch: `feat/global-access-loading`, criada da `main` local. `main` e a referência
local `origin/main` coincidiam. Fetch/pull falharam por bloqueio de rede ao GitHub;
não foi possível comprovar que essa referência é a mais recente no servidor.
Não houve merge nem push.

- `npm run typecheck`: passou.
- `npm test`: passou, incluindo prazo total durante espera pelo lock e durante
  transporte, cancelamento, deduplicação, tentativa manual e orçamento restrito
  no proxy. Os testes existentes cobrem sessão válida, expirada, inválida, refresh
  único, erro de rede, contratos e ausência de repetição de erros de negócio.
- Build com `NEXT_BUILD_WORKER_THREADS=true`: passou.
- Política de código (`node scripts/lint.mjs`): passou. O lint completo encontra
  formatação preexistente em nove arquivos: package.json,
  README.md, cinco scripts anteriores, src/app/api/[...path]/route.ts e
  src/config/public.ts. A formatação dos arquivos novos e do código alterado foi
  verificada separadamente. Em package.json foi acrescentado somente o script de
  teste de navegador, preservando a formatação anterior.
- Chromium não abriu: `browserType.launch: spawn EPERM`. O servidor de
  desenvolvimento também recebeu `spawn EPERM`. Não foi possível validar
  visualmente ou executar a matriz de navegador neste ambiente.

Para executar a matriz preparada, rode `npm run build`, `npm start` na porta 3000
e, em outro terminal, `npm run test:access:browser`. O teste intercepta a API com
fixtures, sem contas ou banco reais. Cobre 390×844, 768×1024 e 1440×900, espera lenta,
cobertura/centralização, movimento reduzido, foco/teclado, eventos e formação com
feedback local, erro 409, falha de rede, prazo total, retry manual, revalidação
secundária e sessão expirada/inválida. Imagens ficam em `.test-build/access-loading`.
Essa matriz está preparada, mas não foi executada com sucesso neste ambiente.
O despertar real no Render e limites da hospedagem continuam pendentes de teste
na implantação de revisão.

## Arquivos da mudança

- `src/features/auth/components/global-access-loading.tsx` e
  `global-access-loading.module.css`: modal reutilizável e apresentação.
- `src/features/auth/access-timing.ts`, `auth.service.ts`, `auth-coordinator.ts` e
  `use-auth.ts`: prazo, cancelamento, coordenação e contexto da restauração.
- `src/features/auth/components/auth-screen.tsx` e `recovery-screen.tsx`;
  `src/features/events/components/events-screen.tsx` e `stats-screen.tsx`:
  integração nas telas existentes.
- `src/lib/http/api-proxy.ts`: prazo do transporte de sessão no servidor Next.
- `tests/auth.test.ts`, `tests/proxy.test.ts`, `scripts/access-loading.test.mjs` e
  `package.json`: testes e comando para a matriz de navegador.
- `docs/access-loading.md`: decisões, rastreabilidade e limitações desta entrega.

## Diagnóstico do bloqueio de navegador — 15/10/2026

O comando `npm run test:access:browser` chama
`node scripts/access-loading.test.mjs`, que usa `chromium.launch({ headless: true })`.
Playwright 1.64.0 tentou executar:

```text
C:\Users\Matheus\AppData\Local\ms-playwright\chromium_headless_shell-1248\chrome-headless-shell-win64\chrome-headless-shell.exe
```

O erro ocorre no lançamento (`browserType.launch: spawn EPERM`), antes de abrir
qualquer página ou realizar as asserções visuais. O comando gerado pelo Playwright
usa `--remote-debugging-pipe` e canais stdio para controlar o processo.

Verificações realizadas:

- O executável existe (216.950.272 bytes), tem cabeçalhos PE válidos e marcador
  `INSTALLATION_COMPLETE`. A listagem do Playwright reconhece Chromium e o shell
  headless da revisão 1248.
- A execução direta de `chrome-headless-shell.exe --version` pelo PowerShell
  funcionou: `Google Chrome for Testing 156.0.8078.4`.
- A ACL concede `ReadAndExecute` ao grupo `CodexSandboxUsers` e controle total ao
  usuário. Não foi encontrado fluxo `Zone.Identifier`.
- Um subprocesso mínimo do próprio Node (`node --version`) reproduz `EPERM` com
  `stdio: 'pipe'`, mas funciona com `stdio: 'inherit'` e `stdio: 'ignore'`.
  `cmd.exe` também falha quando iniciado pelo Node com pipes.
- O modelo de permissões interno do Node não está ativo. Não foram encontrados
  eventos correspondentes nos últimos 20 minutos nos logs consultados de
  Code Integrity e AppLocker/EXE and DLL. A ausência desses eventos não comprova
  a ausência de toda política do Windows; a execução direta confirma que não há
  um bloqueio geral desse executável.

As evidências isolam a falha ao uso de canais de subprocesso no ambiente restrito,
sem evidência de instalação ausente ou danificada. Não foi reinstalado o navegador.

Foi considerada uma conexão local `connectOverCDP`, suportada pelo Playwright,
iniciando o navegador separadamente, com perfil de teste isolado e sem desativar
proteções. A tentativa de lançamento por `Start-Process -WindowStyle Hidden` foi
rejeitada antes de executar pelo controle automático de aprovação:

```text
approval required by policy, but AskForApproval::Granular.sandbox_approval is false
```

Essa configuração impede solicitar elevação nesta sessão. Nenhum processo dessa
tentativa foi iniciado. Não foram alterados a aplicação, os argumentos de segurança
do navegador, a política do Windows ou o teste para contornar o bloqueio. A branch
continua `feat/global-access-loading`, sem merge ou push. A matriz visual permanece
pendente.

### Execução local, fora do Codex

No primeiro terminal PowerShell:

```powershell
Set-Location 'C:\Arquivos de Desenvolvimento\meus-repositorios\patotaFUT\patotaFUT-frontend'
git branch --show-current
$env:NEXT_BUILD_WORKER_THREADS = 'true'
npm run build
npm start
```

Confira que a branch exibida é `feat/global-access-loading`. Mantenha o servidor
na porta 3000. Em outro terminal PowerShell, fora do Codex:

```powershell
Set-Location 'C:\Arquivos de Desenvolvimento\meus-repositorios\patotaFUT\patotaFUT-frontend'
npm run test:access:browser
```

O teste deve emitir três linhas `PASS`, para 390×844, 768×1024 e 1440×900, e salvar
as respectivas capturas em `.test-build/access-loading`. As respostas da API são
simuladas no navegador: não exige backend ativo e não comprova o despertar real
do Render. Se outro ambiente informar especificamente que o executável está
ausente, instale a revisão compatível com o Playwright local usando
`npx playwright install chromium` e execute o teste novamente. Esse procedimento
não é necessário para a instalação verificada nesta sessão.

## Correção da espera de navegação do teste

Fonte: relato posterior do usuário: Chromium abre fora do Codex, mas `page.goto`
atinge 30 segundos esperando `load` em `/events`, embora a página abra normalmente.

O teste usava a espera padrão `load` antes de executar suas asserções. Na primeira
navegação, as respostas simuladas de `/auth/me` e `/events` ficam intencionalmente
pendentes até a validação do loading. A espera por `load` não expressa o estado
que o cenário pretende verificar e também depende de recursos externos, como a
folha de fontes do Google importada pelo CSS. Requisições XHR pendentes não
comprovam, isoladamente, o motivo de `load` não ocorrer; sem o registro do navegador
da execução externa não é possível atribuir o bloqueio a um recurso específico.

Correções limitadas ao teste e a este registro:

- Todas as navegações e recargas aguardam `domcontentloaded`. As asserções
  explícitas do overlay, contagem de chamadas, eventos, falha, retry, renovação e
  sessão inválida continuam preservadas. As navegações sem redirecionamento esperado
  também verificam a URL de destino; a sessão inválida continua verificando `/`.
- Não foram acrescentadas pausas fixas, ampliados timeouts, liberadas antecipadamente
  as respostas simuladas ou alterados recursos da aplicação.
- Em falha, o teste salva `.test-build/access-loading/<largura>-diagnostics.json`
  e imprime cenário, URL final, requisições pendentes/com falha, respostas de erro,
  erros de console e JavaScript, navegações/redirecionamentos e eventos de ciclo
  de página. Também distingue os gates de API intencionalmente retidos e registra
  quando são liberados. Esperas pendentes são liberadas ao encerrar cada contexto.

A consulta HTTP local a `/events` retornou 200 e a mesma URL, sem redirecionamento.
Sintaxe e formatação do script foram verificadas. A tentativa de executar a matriz
no Codex continuou falhando em `chromium.launch` com `spawn EPERM`, antes da
navegação. Portanto, a correção ainda requer execução externa; não representa
validação visual concluída. Com a aplicação já na porta 3000, basta repetir
`npm run test:access:browser` no PowerShell externo, na pasta do frontend. Se houver
nova falha, o JSON de diagnóstico permitirá identificar o recurso ou estado exato.

## Verificação de foco sem controles durante o loading

Fonte: relato posterior do usuário sobre a asserção após Escape e Tab. O arquivo
`390-diagnostics.json` disponível confirma a falha, a URL `/events` e a espera
intencional por `/auth/me`, mas não contém o elemento ativo. Não permite afirmar
que um controle subjacente recebeu foco.

A asserção anterior exigia que `document.activeElement` estivesse sempre no dialog.
Isso era mais restritivo que o requisito: o loading não possui controles e o
navegador pode mover o foco à sua própria interface durante a navegação por Tab.
O elemento ativo exposto pelo documento pode então ser `body`.
O [padrão HTML](https://html.spec.whatwg.org/multipage/interaction.html#focus)
distingue foco do documento e da interface do navegador; o
[dialog modal](https://html.spec.whatwg.org/multipage/interaction.html#inert-subtrees)
torna o restante do documento inerte implicitamente, sem precisar acrescentar o
atributo `inert` a cada controle.

A implementação já usa `showModal()`, impede o cancelamento por Escape, anuncia
`carregando` por `role="status"`, respeita movimento reduzido e restaura o foco
anterior quando o elemento ainda está conectado. Não há evidência que justifique
alterar a aplicação ou adicionar uma armadilha de teclado neste momento.

O teste foi ajustado para validar o isolamento efetivo:

- Exige que o dialog permaneça aberto como modal nativo (`:modal`).
- Registra o elemento ativo, id, papel, rótulo, link e `document.hasFocus()` após
  Escape, Tab e Shift+Tab. O primeiro Tab também imprime `FOCUS` no terminal.
- Aceita foco no dialog, seus descendentes ou o estado neutro em `body`/`html`.
  Qualquer outro elemento ativo fora do dialog falha, incluindo o `main` da tela.
- Percorre Tab e Shift+Tab em quantidade baseada nos controles subjacentes e
  registra `focusin` para detectar inclusive foco transitório no conteúdo bloqueado.
- Tenta focar todos os controles visíveis e habilitados da aplicação por baixo,
  incluindo a região principal, botões e links. Todos devem rejeitar foco.
- Verifica Enter/Space sem ativações no conteúdo bloqueado ou mudança da URL.
  Mantém a verificação existente de clique no menu bloqueado.
- Exige foco no botão de tentar novamente após falha. Em uma revalidação explícita
  de sessão por aviso entre abas, verifica que o foco retorna ao link anteriormente
  focado quando o loading termina e esse link permanece na tela.

Não há pausas fixas. Nenhuma asserção de loading, sessão ou movimento reduzido foi
removida. Sintaxe, formatação e `git diff --check` passaram. A execução de navegador
no Codex continua impedida por `spawn EPERM`; o elemento exato da falha anterior e
o resultado da matriz corrigida ainda precisam de execução externa. Use
`npm run test:access:browser` com a aplicação na porta 3000. Se houver vazamento de
foco, o teste falhará com a descrição do elemento no terminal e no diagnóstico JSON.

## Sincronização do cenário de formação local — 15/10/2026

Fonte: relato do usuário de aprovação em 390×844 e falha em 768×1024 na
linha 396 de `scripts/access-loading.test.mjs`, com `actual: 0`, `expected: 1`,
e POST de formação seguido de `mock-wait` no diagnóstico externo.

Essa linha verificava `state.formCalls`, incrementado pelo handler do mock de
formação. Não verificava a quantidade de indicadores na interface. O fluxo
`run` marca `busy` antes de aguardar `protectedRequest`, que passa pela
coordenação e pelo CSRF antes do POST. Portanto, o botão `Formando...`
desabilitado pode aparecer enquanto o contador ainda é zero. O diagnóstico
`768-diagnostics.json` disponível localmente registra esse estado: CSRF pendente
e `formCalls: 0`. O POST relatado posteriormente é compatível com a chegada
assíncrona da requisição; não há evidência de lógica distinta no tablet.

O teste agora aguarda `expect.poll(() => state.formCalls).toBe(1)`, sem pausa fixa
nem aumento de timeout. A resposta permanece retida pelo gate durante essa
espera. As verificações anteriores de botão desabilitado e ausência do overlay
continuam e são repetidas após a chegada do POST, antes de liberar o gate.
Após a mensagem do 409, permanece a verificação de ausência do loading global
e é conferido novamente que houve exatamente uma chamada de formação.

A alteração limita-se ao teste e a este registro. Não altera aplicação,
permissões, contratos ou regras de formação RN27–RN36; o feedback local continua
sendo uma decisão de apresentação. A matriz completa continua sendo executada
por `npm run test:access:browser`, nas três resoluções já configuradas.

Verificação desta correção: sintaxe do script, formatação dos dois arquivos e
`git diff --check` passaram. A tentativa da matriz neste ambiente falhou novamente
em `chromium.launch` com `spawn EPERM`, antes dos cenários; a aprovação nas três
resoluções permanece pendente da repetição externa. Branch mantida em
`feat/global-access-loading`, sem merge para `main`.

### Resultado externo após a correção

Fonte: saída do PowerShell externo fornecida pelo usuário após a correção da
sincronização. A matriz completa passou em **390×844, 768×1024 e 1440×900**,
incluindo acesso lento, cobertura, bloqueio de foco/teclado, movimento reduzido,
eventos e formação com feedback local sem loading global, erro 409, falha de rede,
prazo total, tentativa manual, revalidação secundária e sessões expirada/inválida.
Essa execução resolve a pendência de aprovação externa da matriz corrigida.

Nas três resoluções, o registro após Escape e Tab mostrou `BODY` como elemento
ativo, `documentHasFocus: false`, `modal: true`, `blockedElementFocused: false`,
`leaks: []` e `activations: []`. Esse resultado corresponde ao estado neutro de
foco previsto pelo teste, sem foco ou ativação no conteúdo bloqueado.

A validação utiliza API simulada; o despertar real no Render e os limites da
hospedagem continuam pendentes de validação na implantação de revisão.
