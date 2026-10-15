# Entrada de datas em dispositivos móveis

Fonte: pedido do usuário de correção da entrada numérica de datas. Implementado
na branch atual `main`, sem mudanças em layout, backend ou contratos.

## Levantamento e escopo

Consultados os livros de regras e modelos, incluindo notas e lacunas. RN09 exige
data e horários do evento; RN11 trata da edição. Essas regras permanecem intactas.
A busca no frontend encontrou uma única entrada de data: `EventForm`, usada em
criação e edição. Diferentemente do relato de `type="number"`, a versão atual já
usava texto com teclado numérico, mas não inseria as barras exigidas pela validação.
Não havia biblioteca de máscara ou componente de entrada de data compartilhado.
Formação e recuperação de senha têm campos numéricos com outro significado e
permanecem intactos. Estatísticas não possuem entrada de período implementada.

## Solução

- `date-entry.ts`: formata até oito dígitos como DD/MM/AAAA, aceita entrada com ou
  sem barras e calcula a seleção por posição dos dígitos. Ao apagar uma barra com
  Backspace/Delete, remove também o dígito adjacente para permitir continuar a
  exclusão sem prender o cursor. Valores parciais permanecem editáveis.
- `components/date-input.tsx`: entrada compartilhada de texto com
  `inputMode="numeric"`, preservando a seleção depois de cada alteração. Sem
  dependências adicionais ou estilos novos.
- `components/event-form.tsx`: usa a entrada compartilhada e limpa o erro de data
  durante a correção. Valida no envio, reutilizando `events.calendar.ts` e
  `events.validation.ts`, incluindo dias por mês e anos bissextos.
- A API continua recebendo `AAAA-MM-DD`, por reorganização dos segmentos da
  string, sem converter a entrada em instante local. Horários, permissões e
  revisão da edição permanecem inalterados.

## Verificação

`tests/events.test.ts` cobre digitação, valores parciais, inserção com/sem barras,
substituição de mês, exclusão no meio, exclusão de separadores nas duas direções,
limpeza completa, datas impossíveis e bissextos (incluindo 1900 e 2000). O teste de
criação/edição passa pela formatação e conversão e verifica o payload da API.
`npm test`, `npm run typecheck`, política de código e formatação dos arquivos
alterados passaram.

`scripts/date-entry.test.mjs` prepara a verificação no navegador para mobile,
tablet e desktop em America/Sao_Paulo e Pacific/Kiritimati: atributos de teclado,
digitação, seleção/cursor, Backspace, inserção em bloco simulando colagem,
validação somente no envio e payloads de criação/edição. A execução aqui foi
bloqueada em `chromium.launch` por `spawn EPERM`, antes dos cenários.

Para testar em produção local, encerre o servidor anterior com Ctrl+C e gere um
novo build. `npm start` serve o conteúdo de `.next`, não recompila alterações em
`src`. No primeiro PowerShell externo:

```powershell
Set-Location 'C:\Arquivos de Desenvolvimento\meus-repositorios\patotaFUT\patotaFUT-frontend'
$env:NEXT_BUILD_WORKER_THREADS = 'true'
npm run build
if ($LASTEXITCODE -eq 0) { npm start }
```

Com esse servidor na porta 3000, execute em outro PowerShell externo:

```powershell
Set-Location 'C:\Arquivos de Desenvolvimento\meus-repositorios\patotaFUT\patotaFUT-frontend'
node scripts/date-entry.test.mjs
```

Na primeira repetição externa, o teste recebeu `15102026` sem formatação e o
HTML ainda continha `maxlength="10"`. O componente atual não emite esse atributo;
o bundle local em `.next/static/chunks` ainda contém `maxLength:10`. Essas
evidências indicam a execução contra o build anterior. A repetição com o build
atualizado continua pendente; não houve alteração nas asserções para aceitar a
data sem barras.

### Resultado externo com o build atualizado

Fonte: saída do teste fornecida pelo usuário após reconstruir o frontend.
Os seis cenários passaram: 390×844, 768×1024 e 1440×900, cada um em
America/Sao_Paulo e Pacific/Kiritimati. Essa execução resolve a pendência de
validação externa do script, incluindo digitação, seleção e posição do cursor,
exclusão, inserção em bloco com/sem barras, datas incompletas e inválidas,
ano bissexto e payloads de criação/edição sem deslocamento do dia pelo fuso.
A falha anterior não se repetiu com o build atualizado.

Não houve teste em dispositivo físico. A abertura efetiva do teclado numérico,
os comandos de colagem do sistema e o comportamento em Safari/iOS e Android
continuam pendentes de conferência real; a emulação não comprova esses aspectos.
