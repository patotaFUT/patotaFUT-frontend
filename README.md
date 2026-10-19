# PatotaFUT — frontend

Preferências e exclusão (18/10/2026): `/org/preferences` permite editar a própria
conta; a central fica acessível aos três perfis. `/org/members` fornece somente
listagem e exclusão autorizada ao Organizador. Sessão continua em `/auth/me`, sem
credenciais no storage. Testes de contratos em `npm test`; roteiro visual novo em
`npm run test:accounts:browser` (a execução Chromium foi bloqueada neste ambiente).
[Implementação, contratos e limitações](../docs/implementacao-preferencias.md).

O frontend contém **login, cadastro local, recuperação de senha, eventos e times**, com suas integrações.
Login fica em `/` e “Registre-se” em `/register`, com navegação entre as duas telas.
O cadastro é uma extensão autorizada, derivada visualmente do login; não faz parte
do PDF original. Recuperação fica em `/forgot-password` e também é uma extensão
autorizada derivada do login. Vinculação de contas continua fora do escopo.
Após autenticação, o usuário segue para `/events`. A Organização usa `/org/events`,
com gerenciamento de eventos e times em suas subrotas. `/stats` permanece em breve.

## Executar

Node.js 22.17 ou superior e npm. A base foi gerada por create-next-app 16.2.3,
com App Router, src e TypeScript strict. Next 16.2.3 aceita React 18.3.1 em suas
peer dependencies; usamos essas versões disponíveis no cache local. Não houve
substituição por outra stack. O lint verifica a política de tipos no AST TypeScript
e formatação com Prettier; não é ESLint, cujo pacote não estava disponível offline.

```powershell
cd patotaFUT-frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Se `.env.local` já existir, preserve-o em vez de executar a cópia. Nesta entrega
foi criado um arquivo local ignorado pelo Git, com a URL da API exclusiva do servidor e o Client
ID público já configurado nela. Não contém segredos do backend.

Abra **http://localhost:3000**. A API deve rodar separadamente em
**http://localhost:8080**. `npm start` também usa 3000 e requer build prévio.

| Comando             | Uso                                                             |
| ------------------- | --------------------------------------------------------------- |
| `npm run dev`       | Next em desenvolvimento, porta 3000                             |
| `npm run build`     | Build e verificação de tipos do Next                            |
| `npm start`         | Servir o build, porta 3000                                      |
| `npm run typecheck` | TypeScript strict e checagem de nulos                           |
| `npm run lint`      | Política sem any/casts/assertions/supressões/storage e Prettier |
| `npm run format`    | Formatar                                                        |
| `npm test`          | Compilar testes TypeScript e executar node:test                 |

Neste ambiente, o build convencional compilou, mas não pôde criar o subprocesso
de verificação (`spawn EPERM`). A opção oficial de workers em threads permitiu
executar o build completo, mantendo o TypeScript habilitado:

```powershell
$env:NEXT_BUILD_WORKER_THREADS='true'
npm run build
```

Essa variável é de build, não pública, e é opcional em ambientes sem essa restrição.
Os testes usam tsc + node:test, sem subprocessos de transformação do tsx.

## Ambiente, cookies e origem

| Variável                       | Valor local                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `API_URL`                      | `http://localhost:8080`; exclusiva do servidor Next.js                          |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | OAuth Web Client ID igual ao `GOOGLE_CLIENT_ID` da API; vazio desabilita Google |

Variáveis NEXT_PUBLIC são incorporadas no build e são visíveis no navegador.
Nunca coloque client secret, segredos JWT, credenciais Atlas ou senhas nelas.
Depois de mudá-las, reinicie o dev server ou reconstrua produção.

Na API, a origem exata do frontend deve constar em:

```dotenv
PORT=8080
AUTH_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
AUTH_ALLOW_INSECURE_COOKIES=true
AUTH_COOKIE_SAME_SITE=lax
NODE_ENV=development
```

A origem 8080 foi preservada para o Postman. A definição duplicada de CORS foi
corrigida anteriormente e o Nodemon recarregou a API; veja o diagnóstico posterior
em docs. Ao modificar o ambiente, garanta o recarregamento da API. O navegador
fornece Origin automaticamente; não monte esse
header manualmente no frontend. localhost e 127.0.0.1 não são a mesma origem.

As notas iniciais em `../docs/implementacao-autenticacao.md` citam PORT=3000 para
a API. Isso difere da configuração atual em 8080; as notas posteriores do mesmo
documento registram a mudança. Os livros originais não foram alterados.

Produção exige URLs HTTPS, origens explícitas e cookies Secure definidos pelo
backend. O navegador acessa somente `/api` no domínio do frontend. O Next.js
encaminha `/api/auth/*` para `/auth/*` e `/api/events/*` para `/events/*` na API,
sem acrescentar outro `/api` ao destino. Essa topologia permite SameSite=Lax:
os cookies pertencem ao frontend, mesmo com a API hospedada no Render.

### Deploy Vercel → Render

Na Vercel, configure `API_URL=https://sua-api.onrender.com` no ambiente de produção
e nos ambientes de preview que usarão essa API. O valor é a origem da API,
sem `/api`, credenciais, query ou fragmento; uma barra final é aceita. Não use
`env` do next.config para expor essa variável. Não copie JWT, CSRF secrets,
credenciais MongoDB ou segredos Google para o frontend. O único Client ID Google
público continua em `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

Após publicar esta versão, remova `NEXT_PUBLIC_API_URL` da Vercel e configure
`API_URL`. É necessário um novo build/deploy para aplicar a mudança. Não basta
editar as variáveis de um deploy antigo. Localmente, use `API_URL=http://localhost:8080`
em `.env.local` e reinicie o Next.js.

No Render, mantenha `NODE_ENV=production`, `AUTH_COOKIE_SAME_SITE=lax` e
`AUTH_ALLOWED_ORIGINS=https://seu-frontend.vercel.app` (ou o domínio personalizado).
Liste outras origens autorizadas explicitamente, separadas por vírgula; não use
wildcards nem libere previews desconhecidos. A origem não inclui `/api` nem barra
final. Secure é obrigatório em produção pela configuração atual da API.
Autorize também a origem real do frontend no cliente OAuth Google, se usado.

O Route Handler é necessário porque um rewrite isolado não adapta o refresh
(`Path=/auth`) e a recuperação (`Path=/auth/recovery`). Cada `Set-Cookie` é
preservado separadamente: caminhos específicos recebem `/api`, enquanto `/`
permanece `/`. Domain é removido para manter cookies host-only no frontend.
HttpOnly, Secure, SameSite, Max-Age e Expires são preservados, inclusive ao apagar
cookies. O proxy preserva o Origin recebido, sem fabricar uma origem autorizada,
e encaminha Cookie, X-CSRF-Token, Content-Type, métodos, query e corpo. A API
continua responsável por autenticação, autorização e validação CSRF.

Não há cache de respostas do proxy: fetch usa `no-store`, a rota é dinâmica e
respostas privadas desabilitam cache no navegador e na CDN. URL inválida ou
ausente retorna 503 seguro; falha de transporte retorna 502/504, sem detalhes
internos. O cliente não pode escolher host ou protocolo de destino.

`HTTP_TRUST_PROXY_HOPS` não foi alterado. Sem verificar os cabeçalhos de uma
requisição real Vercel → Render, não é possível determinar um número seguro de
saltos. O proxy não repassa X-Forwarded-\* fornecidos pelo cliente. A atribuição
do IP e o limite de login por IP podem agrupar usuários pelo IP de saída do proxy;
valide essa cadeia no ambiente hospedado antes de mudar a confiança ou os limites.

As chamadas atuais de autenticação/eventos são feitas por Client Components e
usam o Axios de navegador com `/api`. O Route Handler usa URL absoluta no servidor.
Não há chamada autenticada em Server Components atualmente. Se adicionada,
deve acessar a API diretamente com URL absoluta e encaminhar explicitamente os
cookies da requisição corrente; não reutilize o coordenador de navegador no servidor.
Renovações que alterem cookies precisam ocorrer em Route Handlers ou Server Actions.

## Fluxo de sessão

Axios central usa baseURL relativa `/api`, withCredentials=true e timeout. Todos os POST
enviam JSON e X-CSRF-Token. Antes de cada POST, GET /auth/csrf obtém um token novo,
usado apenas em memória durante essa operação. O GET e o POST compartilham o
mesmo Web Lock; outra aba desta aplicação não pode substituir o cookie entre eles.
Buscar CSRF novamente também resolve sua expiração e a remoção após logout/refresh
rejeitado. Não há cache persistente nem token compartilhado via armazenamento.

/auth/me restaura a sessão e obtém o usuário real. Uma resposta 401 permite um
único refresh e uma única repetição de /me. Login, Google e refresh não entram
nesse caminho de renovação. Chamadas pendentes compartilham a restauração na aba.
Entre abas, inclusive a leitura de /me ocorre sob Web Lock: uma leitura pendente
observa o access cookie renovado pela primeira aba e evita outra rotação.

BroadcastChannel comunica somente mudanças de sessão, nunca credenciais. A aba
receptora consulta /me sem iniciar outro refresh, evitando ciclos de notificação
e consultando o usuário atual no backend. Reativar uma aba também verifica /me.
O estado distingue verificação, autenticação, ausência de sessão e falha de
comunicação. Falha de rede não é apresentada como senha incorreta ou logout.

A coordenação exige Web Locks e BroadcastChannel em contexto seguro (HTTPS ou
localhost). Navegadores sem essas APIs recebem indicação de incompatibilidade;
não há fallback que arrisque rotações concorrentes. A coordenação cobre abas da
mesma origem frontend, não Postman ou outro aplicativo/origem que altere os mesmos
cookies em paralelo.

Access/refresh permanecem exclusivamente em cookies HttpOnly emitidos pela API
e encaminhados ao domínio do frontend pelo proxy. O código de navegador
não lê esses cookies, não cria Authorization e não usa localStorage/sessionStorage.
ID token Google só transita do callback oficial para o POST, sem estado React ou
logs. A senha digitada não é normalizada e só é limpa após autenticação confirmada.

Após sucesso, nome, e-mail e função vindos da API aparecem discretamente na própria
tela. A função é informativa: autorização cumulativa e consulta ao usuário atual
continuam no backend (RN02–RN03/RN07). Logout aguarda 204 e limpa o estado local;
falha de comunicação mantém o resultado incerto visível. Conforme a API, um access
previamente copiado pode continuar válido por até 15 minutos após logout.

## Google

Google Identity Services carrega o script oficial e mantém o botão real, em
português, com callback de ID token. Conforme a correção visual solicitada pelo
usuário, a face visível reproduz o PDF: preto puro, texto branco e marca Google à
direita, extraída da própria página 8. A face decorativa não recebe cliques e fica
fora da árvore acessível; os eventos continuam chegando ao botão do SDK.

O SDK recebe theme=filled_black e logo_alignment=left, valores válidos. Seu
logo_alignment só aceita left/center, portanto a composição à direita é uma
personalização visual do PatotaFUT, não uma opção nativa do provedor.
[Referência oficial do SDK](https://developers.google.com/identity/gsi/web/reference/js-reference#logo_alignment).
O foco aparece na face visível e a desativação continua cobrindo o controle real.
O clique e o fluxo Google real ainda precisam ser conferidos no navegador.

No console Google, use um cliente OAuth **Web** e autorize a origem JavaScript
**http://localhost:3000**; a configuração de produção deverá usar sua origem HTTPS.
O Client ID público precisa ser o mesmo em ambos os projetos. Este fluxo não usa
OAuth Playground, access token OAuth nem client secret no navegador.

Após a atualização autorizada das credenciais em 10/10/2026, `.env.local` usa
o novo `GOOGLE_CLIENT_ID` definido no `.env` da API. Variáveis com sufixo `_DEV`
não são selecionadas automaticamente: a API continua lendo `GOOGLE_CLIENT_ID`.
O `GOOGLE_CLIENT_SECRET` permanece somente no backend e não é necessário para
este fluxo de ID token. Reinicie o frontend após alterar o Client ID; em
produção, gere um novo build. Nenhum valor real é incluído nesta documentação.

Sem Client ID ou se o script não carregar, a interface informa a indisponibilidade
e mantém login local. Audience incorreta, identidade inválida, limite de tentativas
e conflitos de conta têm mensagens seguras centralizadas. A vinculação automática
por e-mail continua bloqueada pela API (RN63/RN71–RN75). Se o Google omitir nome ou
sobrenome exigidos por RN01, a interface informa que complementação de cadastro
está fora desta etapa; os campos opcionais do contrato não geram uma nova tela.

## Estrutura e visual

- `src/app`: rotas de login, cadastro e recuperação, layout e entrada CSS; componentes com
  formulário, hooks ou SDK Google são Client Components.
- `src/features/auth`: contratos, validação, serviço, conteúdo, hook e coordenador.
- `src/features/auth/components`: AuthScreen e seu CSS Module compõem login/cadastro
  e sessão; LoginForm/RegisterForm compartilham auth-form.module.css; AuthField e seu
  módulo mantêm campos/bordas/foco e visibilidade; GoogleButton integra o SDK e tem
  seu próprio módulo.
- `AuthLayout` e seu módulo compartilham shell/logo entre essas telas;
  `RecoveryScreen` e seu módulo implementam as quatro etapas de recuperação.
- `src/components/ui`: Button e seu CSS Module, reutilizado por Entrar/Sair.
- `src/lib/http/client.ts`: Axios genérico; coordenação está em auth.
- `src/app/api/[...path]/route.ts` e `src/lib/http/api-proxy.ts`: proxy Node.js,
  configuração `API_URL`, encaminhamento privado e adaptação do escopo dos cookies.
- `src/config/public.ts`: configuração pública, endpoints e apresentação.
- `src/styles/tokens.css`: tokens compartilhados. globals.css contém reset,
  bases e utilitário acessível; login.css global foi removido.
- `public/patotafut-logo.png`: imagem original extraída do objeto 77 da página 8 do
  PDF, com transparência e apenas margens transparentes removidas.
- `tests/auth.test.ts`: cenários de autenticação com adapter Axios simulado.
- `tests/proxy.test.ts`: transporte, configuração fixa, cookies e falhas com fetch simulado.
- `npm run test:proxy:browser`: Chromium → Next de produção (porta 3100) → Express
  real, com os Services da API e persistência somente em memória. Execute os builds
  nos dois projetos antes. Não cria contas nem grava no MongoDB. As capturas ficam
  em `.test-build/proxy-auth/`. Cobre login, reload, refresh, logout, sessão expirada,
  rejeição Origin/CSRF e caminhos de rede `/api`; não comprova o deploy Vercel/Render.

As páginas 2–8 foram renderizadas e examinadas visualmente. Cores, escala de fontes
12/14/16/18/20/28, pesos 400/500/600/700, espaçamentos e raios seguem as tabelas.
O layout central preserva a composição mobile sem criar áreas adicionais no desktop.
O breakpoint 768px, tamanho proporcional da logo e valores de acessibilidade são
decisões de implementação identificadas nos tokens, não valores atribuídos ao PDF.

A logo embutida tem 174×217 px úteis, suficiente para a exibição a 136px de largura,
mas não é um arquivo vetorial e perde nitidez quando ampliada. A fonte Inter é
carregada por Google Fonts em runtime; sem acesso ao serviço usa fallback do sistema.
O build não depende de baixar fontes. Labels associados, autocomplete, Enter,
mostrar/ocultar senha, foco e mensagens acessíveis estão implementados.

## Verificação e limites

Os testes de frontend usam **mocks**, incluindo cookies simulados e fila de locks.
Eles não comprovam Atlas, GIS remoto, cookies reais no navegador ou concorrência
real entre abas. A validação runtime rejeita usuário inválido, função desconhecida,
tokens no JSON e dados privados. O lint impede any, casts, non-null assertions,
supressões e referências ao armazenamento do navegador.

Rastreabilidade: RN02–RN03/RN07 validam papéis/usuário público, com autorização
mantida na API; RN71 cobre os fluxos local/Google; RN63/RN72–RN75 são garantias do
backend preservadas, com teste de reação ao conflito. CSRF, cookies, concorrência,
renovação, logout, limites e validação de JSON são requisitos de segurança,
distintos das RN.

Resultados e pendências desta entrega estão em
`../docs/implementacao-frontend-login.md`. Login com uma conta real e Google exigem
verificação no navegador com a API em execução. Nenhum usuário falso é utilizado
na execução normal. Não houve cadastro real ou uso de senhas de usuários nos testes.

## Refatoração: layout e estado

Decisões autorizadas e arquivos movidos estão em
[Reestruturação, layout e arquitetura](../docs/implementacao-frontend-login.md#reestruturação-layout-e-arquitetura).

O shell usa altura e limite 100dvh com fallback 100vh, incluindo padding/safe areas.
O main é a região de rolagem interna, identificada e acessível por teclado.
Margens automáticas centralizam quando há espaço sem ocultar o começo em telas
baixas. Logo e espaçamentos se adaptam abaixo de 740/600px; fontes e áreas de toque
não são reduzidas. O viewport solicita interactive-widget=resizes-content para
navegadores compatíveis, sem impedir zoom.
[Referência oficial Next](https://nextjs.org/docs/app/api-reference/functions/generate-viewport).

Somente AuthScreen usa useAuth, nas rotas de login e cadastro. Não há Context global;
a sessão é restaurada pela API quando necessário e os campos permanecem locais
em cada formulário. Quando houver necessidade de gerenciamento
de estado global compartilhado na aplicação, a solução preferencial é Redux com
Redux Toolkit e React Redux. CSRF e coordenação continuam fora de qualquer store.
Não instale Redux para estado local de formulário nem persista tokens.

Checklist manual: 390×844, 320×568, 390×667, 1440×900 e 844×390; zoom de 200%;
Tab/Enter, mostrar senha, campos inválidos e erros longos; teclado virtual com
cada campo focado. Conferir ausência de scroll externo/horizontal, logo proporcional
e todas as ações alcançáveis pela rolagem interna. Conferir GIS carregado, login
local/Google, restauração, refresh em duas abas e logout com contas reais.
A ferramenta está sem navegador conectado; esses cenários visuais/teclado/zoom
e a integração autenticada real não foram verificados nesta refatoração.
Os testes existentes usam API/locks/cookies simulados e não substituem essa checagem.

## Cadastro local

Abra **http://localhost:3000/register** ou “Registre-se” no login. Preencha nome,
sobrenome, e-mail, senha e confirmação. Nomes aceitam até 100 caracteres; e-mail até
254; senha exige pelo menos 12 caracteres e até 1024 bytes, conforme o Service da
API. Não há exigência extra de símbolos/maiúsculas. A senha não é normalizada.

O payload de POST /auth/register contém somente email, password, firstName e
lastName. Confirmação fica no frontend; não há função selecionável. A API impõe
PLAYER e responde 201 { user }, já com sessão/cookies: não há segundo login nem
redirecionamento para outra tela. CSRF novo e cadastro compartilham o mesmo Web Lock.
401 de cadastro não provoca refresh; não existem interceptadores globais de retry.

Erros de campo permanecem próximos aos inputs. Conflito de e-mail (incluindo conta
Google), dados inválidos, CSRF, limite de tentativas e falhas de comunicação têm
mensagens centralizadas. Falhas preservam valores no formulário; sucesso limpa
senha/confirmar senha. Nenhuma credencial é persistida ou registrada em logs.
Google permanece no login; não foi acrescentado um fluxo de cadastro Google.

Resultados, RN, arquivos e limites estão em
[Implementação do cadastro](../docs/implementacao-frontend-cadastro.md).
Antes de testar criação/persistência real, identifique uma API conectada a banco
reservado a desenvolvimento/testes. A conexão Atlas atual não identifica esse
destino; nenhuma conta foi criada por esta entrega. Não use produção nem apague
dados existentes para validar. A interface usa a API real em execução normal;
os cenários positivos automatizados usam mocks, sem comprovar persistência Atlas.

## Recuperação de senha

“Esqueci minha senha” abre `/forgot-password`: e-mail → código/reenvio → nova
senha/confirmação → confirmação com ação para entrar. O cadastro/login continuam
usando suas rotas existentes. Não há senha local criada para conta somente Google.

Usa a mesma API pública, Axios com credentials, coordenação CSRF/Web Locks e campos
compartilhados. Código, senha e confirmação ficam locais; nenhuma credencial é
persistida. As rotas de recuperação não provocam refresh de login nem repetem
automaticamente envio/reset. O backend concede a autorização em cookie HttpOnly;
abrir a etapa de senha não autoriza a operação.

A resposta inicial não confirma que uma conta existe ou que o e-mail foi entregue.
Se a API não estiver configurada para Gmail, a interface informa indisponibilidade.
Segredos do remetente nunca pertencem ao frontend ou NEXT_PUBLIC. Após redefinição,
o usuário retorna ao login por ação explícita, sem autenticação automática.

[Contratos, configuração, decisões e validação](../docs/implementacao-recuperacao-senha.md).
