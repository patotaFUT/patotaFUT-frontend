# Validação da data de eventos

Fonte: pedido do usuário nesta implementação e esclarecimentos aprovados: aceitar
hoje e dias futuros; permitir editar outros campos conservando uma data passada.
Complementa os fluxos das RN09 e RN11 sem reescrever seus enunciados.

O formulário valida no envio, usando o dia civil em `America/Sao_Paulo`, independentemente
do fuso do dispositivo. Uma data diferente da original não pode ser passada;
na criação não existe essa exceção. O dia é recalculado em cada envio, inclusive
quando o formulário permanece aberto durante a meia-noite. A API repete a regra
com seu próprio relógio e a data persistida do evento.

Mantidos a máscara DD/MM/AAAA, teclado numérico, valores parciais durante digitação,
mensagem acessível junto ao campo e contrato YYYY-MM-DD. Não foram alterados horários,
permissões, visual, consultas históricas nem períodos de estatísticas.

## Verificações

- `npm test`: 53 testes aprovados, incluindo datas passadas, hoje, futuro, histórico
  preservado e limites de meia-noite.
- `npm run build`: aprovado, incluindo verificação TypeScript.
- `node scripts/date-entry.test.mjs`: Next e Chromium reais, API simulada, em
  390×844, 768×1024 e 1440×900, nos fusos America/Sao_Paulo e Pacific/Kiritimati.
  Inclui máscara, colagem, edição, datas incompletas/inválidas, bissexto, rejeição
  de passado, histórico inalterado, hoje/futuro e payload civil enviado à API.
- `npm run lint`: política de código aprovada; Prettier aponta 66 arquivos não
  alterados nesta correção. Formatação específica dos arquivos alterados aprovada.

O script inicia o Next de teste na porta 3106 após `npm run build`; para servidor
externo já iniciado, aceita `DATE_ENTRY_TEST_URL`. Nenhum dado de produção é usado.
Não houve teste em dispositivo móvel físico nem teste de persistência real pelo
navegador. O relógio do cliente pode divergir do servidor; a API permanece autoritativa.
