export const legalSite = {
  origin: 'https://patota-fut-bice.vercel.app',
  responsible: 'Equipe PatotaFUT',
  email: 'patotafut@gmail.com',
  updatedAt: '2026-10-19',
  updatedLabel: '19 de outubro de 2026',
};

export const legalLinks = [
  { href: '/privacidade', label: 'Política de Privacidade' },
  { href: '/termos', label: 'Termos de Uso' },
];

export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
  items?: string[];
}
export interface LegalContent {
  title: string;
  description: string;
  introduction: string;
  sections: LegalSection[];
}

export const privacyContent: LegalContent = {
  title: 'Política de Privacidade',
  description:
    'Como o PatotaFUT trata dados de conta, autenticação, eventos e registros esportivos, e como solicitar alterações ou exclusão.',
  introduction:
    'Esta política explica o tratamento de dados no PatotaFUT, aplicativo para organizar eventos de futebol, presenças, times, partidas e estatísticas do grupo.',
  sections: [
    {
      id: 'responsavel',
      title: '1. Responsável e contato',
      paragraphs: [
        `A responsável pelo PatotaFUT e pelo tratamento descrito nesta política é a ${legalSite.responsible}. Dúvidas e solicitações sobre seus dados podem ser enviadas para ${legalSite.email}. Esse também é o canal para quem perdeu acesso à conta ou participa como convidado.`,
      ],
    },
    {
      id: 'dados',
      title: '2. Dados tratados e suas finalidades',
      paragraphs: [
        'Os dados são fornecidos no cadastro, no login, nas Preferências e durante o uso do aplicativo, ou registrados por integrantes com permissão para organizar os eventos e administrar as partidas.',
      ],
      items: [
        'Identificação e conta: nome, sobrenome, e-mail, identificador da conta, função e datas de criação e atualização. Servem para identificar integrantes, permitir contato operacional e aplicar as permissões de Jogador, Administrador e Organizador.',
        'Autenticação e proteção: hash da senha local, quando houver; identificador da conta Google, quando utilizado; registros de sessão, verificadores de tokens e códigos, expirações e contadores de tentativas. Servem para autenticar, recuperar acesso, confirmar alterações e limitar tentativas indevidas. A senha local não é guardada em texto aberto.',
        'Eventos e participação: presença confirmada ou cancelada, vínculo com o evento, time ou reservas e datas desses registros. Servem para organizar participantes e a formação. Convidados têm nome e participação cadastrados pelo Organizador, sem necessidade de uma conta.',
        'Registros esportivos: times, escalações, partidas, duração, gols, assistências e instantes de registro. Servem para manter súmulas, calcular placares, rankings e destaques. As estatísticas individuais derivam das partidas finalizadas; convidados contribuem para o placar, mas não integram os rankings individuais.',
        'Operação de segurança e e-mail: endereço destinatário, novo e-mail pendente de confirmação, dados temporários do desafio e da notificação, e contadores associados a verificadores protegidos de e-mail e IP. Servem para entregar códigos e avisos, controlar reenvios e reduzir abuso.',
      ],
    },
    {
      id: 'visibilidade',
      title: '3. Quem pode visualizar os dados no aplicativo',
      paragraphs: [
        'Integrantes autenticados podem visualizar eventos, nomes de participantes, composição dos times e estatísticas disponíveis ao grupo. Administradores e Organizadores têm acesso aos recursos de gestão conforme sua função. A listagem de integrantes, incluindo nome, e-mail e função, é restrita ao Organizador. Os dados de senha, os códigos e os tokens não são apresentados nessas listagens.',
        'As páginas de Política de Privacidade e Termos de Uso são públicas. Isso não torna públicos os recursos de eventos, estatísticas ou gestão, que exigem autenticação.',
      ],
    },
    {
      id: 'google',
      title: '4. Login com Google',
      paragraphs: [
        'Ao escolher o login Google, o PatotaFUT recebe uma credencial de identidade e verifica sua autenticidade. Utiliza o identificador Google, o e-mail verificado e o nome e sobrenome disponíveis para identificar ou cadastrar sua conta. A senha da sua conta Google não é recebida pelo PatotaFUT. Não há importação de mensagens, contatos ou arquivos pelo login.',
        'O login Google e o login local usam a mesma estrutura de contas. A coincidência de e-mail não vincula nem funde contas automaticamente. Contas exclusivamente Google não precisam de senha local no PatotaFUT.',
      ],
    },
    {
      id: 'emails',
      title: '5. E-mails e autorização da conta remetente',
      paragraphs: [
        'O PatotaFUT usa a Gmail API do Google para enviar códigos de recuperação de senha, códigos de confirmação de novo e-mail e avisos de alterações de credenciais. O Google recebe o destinatário e o conteúdo necessário ao envio.',
        'Essa integração usa uma autorização separada da conta remetente configurada pela equipe, com permissão de envio de e-mail. Ela não é a autorização do jogador ao entrar com Google. O aplicativo não pede acesso à caixa de entrada de cada jogador e não lê suas mensagens para essas funcionalidades.',
        'As credenciais da conta remetente são mantidas na configuração do servidor. Os dados de identidade recebidos do Google são utilizados para a conta e o acesso; o envio pela Gmail API é destinado às mensagens operacionais descritas aqui. O provedor pode limitar ou falhar no envio: uma solicitação ou uma alteração salva não comprova entrega na caixa de entrada.',
      ],
    },
    {
      id: 'cookies',
      title: '6. Sessões, cookies e segurança',
      paragraphs: [
        'O aplicativo usa cookies para manter o acesso e proteger operações. Há cookies de acesso, renovação de sessão, proteção contra requisições indevidas (CSRF) e autorização temporária de recuperação de senha. Na configuração de produção, são HttpOnly e Secure, com regras SameSite. Eles não são gravados no armazenamento local do navegador pelo aplicativo.',
        'O acesso tem validade de 15 minutos; a sessão renovável tem limite absoluto de 30 dias. O cookie de CSRF tem validade de uma hora. A autorização temporária para redefinir a senha vale cinco minutos. Validade não significa acesso irrevogável: alterações efetivas de credenciais e exclusão da conta invalidam as sessões anteriores.',
        'Também existem verificação de permissões no servidor, hash de senhas, validação de códigos, limites de tentativas e controles de concorrência. Esses mecanismos reduzem riscos, mas não tornam o serviço imune a falhas ou acessos indevidos. Não compartilhe senhas, códigos ou sua sessão.',
      ],
    },
    {
      id: 'servicos',
      title: '7. Serviços externos',
      paragraphs: [
        'O Google participa da autenticação pelo login Google e do envio de mensagens pela Gmail API. A interface também carrega a fonte Inter por Google Fonts e o componente de login do Google; essas conexões envolvem dados de rede necessários à comunicação, como o endereço IP.',
        'A Vercel hospeda a interface, o Render hospeda a API do PatotaFUT e o serviço de cluster MongoDB hospeda o banco de dados de contas e eventos. Esses serviços participam do processamento e armazenamento necessários ao aplicativo. Não foi confirmada a região efetiva de armazenamento ou processamento; esta política não afirma que os dados permaneçam exclusivamente no Brasil.',
      ],
    },
    {
      id: 'preferencias',
      title: '8. Alteração dos seus dados',
      paragraphs: [
        'Em Preferências, qualquer usuário autenticado pode alterar seu próprio nome e sobrenome, inclusive em contas Google. A mesma conta e seus vínculos são mantidos, e a identificação passa a refletir o nome atualizado.',
        'Contas locais sem vínculo Google podem trocar senha com senha atual e confirmação da nova senha. A troca de e-mail exige senha atual e código enviado ao novo endereço; o antigo continua válido até a confirmação. Após a troca efetiva de e-mail ou senha, é necessário entrar novamente em todos os dispositivos. Na troca de e-mail, é criada uma notificação ao endereço antigo com o novo endereço parcialmente oculto, sujeita a tentativas de envio e possíveis falhas.',
        'Contas vinculadas ao Google não alteram e-mail ou senha pelas Preferências, mesmo que tenham senha local. Essa tela não oferece criação de senha local ou desvinculação do Google. Isso não impede editar nome e sobrenome nem solicitar exclusão.',
      ],
    },
    {
      id: 'exclusao',
      title: '9. Exclusão da conta e registros das partidas',
      paragraphs: [
        'Você pode excluir sua conta nas Preferências, com sessão autenticada e confirmação em modal. Não é exigida senha atual, código ou nova autenticação Google para essa ação. O Organizador também pode remover integrantes, sob as mesmas condições de bloqueio.',
        'A exclusão é impedida quando a conta é a do único Organizador ou quando há, em evento ativo, presença confirmada, vínculo com time ou reservas, ou participação na escalação de uma partida em andamento. Sem alocação, cancele sua presença; com alocação, peça a um Administrador ou Organizador a remoção da formação e o cancelamento da participação. Uma partida em andamento envolvendo a pessoa deve ser finalizada antes. Confirmações e vínculos de eventos finalizados ou cancelados não impedem a exclusão.',
        'Concluída a exclusão, a conta, seus dados pessoais de cadastro e autenticação e suas sessões são removidos. O vínculo dos registros esportivos com a conta é retirado. Permanecem os identificadores de participação necessários ao histórico, as escalações, gols, assistências e placares, com a identificação “Usuário excluído”. A pessoa deixa de integrar os rankings e destaques individuais, sem transferir créditos para outro participante.',
        'Essa retirada de identificação não é uma garantia de anonimização irreversível: o contexto de uma partida e informações conhecidas pelo grupo podem permitir reconhecer uma pessoa. A preservação não autoriza alterar lances ou placares. Novo cadastro com o mesmo e-mail ou identidade Google cria outra conta, sem recuperar os vínculos e estatísticas anteriores.',
      ],
    },
    {
      id: 'retencao',
      title: '10. Conservação dos dados',
      paragraphs: [
        'Os dados de cadastro permanecem enquanto a conta existe. Os registros esportivos não têm expiração automática no aplicativo e seguem o tratamento descrito acima após a exclusão. Não existe exclusão automática de partidas para atender à remoção de uma conta.',
        'Códigos de confirmação e recuperação valem dez minutos. Desafios e endereços pendentes são marcados para limpeza após 24 horas; contadores têm expiração por janela. Registros de sessão expiram e são sujeitos a limpeza automática. A notificação pendente ao e-mail antigo é marcada para expirar após 24 horas e é removida da fila quando o provedor aceita o envio. A limpeza automática do banco é assíncrona, podendo ocorrer depois da expiração; isso não prolonga a validade de códigos ou sessões.',
        'A equipe ainda não estabeleceu política de backups nem prazos próprios de retenção de logs ou de descarte do histórico esportivo. A remoção pelo aplicativo não apaga mensagens já entregues ao seu e-mail ou à infraestrutura do provedor. Não há comprovação de eliminação imediata em logs e eventuais cópias mantidas por serviços externos. Solicitações sobre conservação podem ser encaminhadas ao contato desta política.',
      ],
    },
    {
      id: 'direitos',
      title: '11. Seus direitos e solicitações',
      paragraphs: [
        `Você pode entrar em contato pelo e-mail ${legalSite.email} para solicitar confirmação de tratamento, acesso ou correção de dados e informações sobre compartilhamento. Também pode solicitar, quando aplicáveis, anonimização, bloqueio ou eliminação de dados, portabilidade, informações sobre consentimento e sua revogação, e revisão de decisões automatizadas, nos termos da LGPD. O canal também atende dúvidas sobre a conservação do histórico e dados de convidados. Não envie senhas ou códigos no pedido.`,
        'A edição e a exclusão disponíveis nas Preferências não substituem esse canal nem esgotam os direitos previstos em lei. Pedidos sobre dados que permanecem no histórico serão avaliados conforme seu contexto e as exigências legais aplicáveis.',
      ],
    },
    {
      id: 'alteracoes',
      title: '12. Atualizações desta política',
      paragraphs: [
        'A versão atual fica disponível nesta página, identificada pela data de última atualização. O sistema não tem aviso automático de revisão da política implementado. Mudanças de finalidade ou de uso de dados que exijam comunicação ou outra providência devem ser avaliadas antes de serem colocadas em prática.',
      ],
    },
  ],
};

export const termsContent: LegalContent = {
  title: 'Termos de Uso',
  description:
    'Finalidade do PatotaFUT, perfis de acesso, participação nos eventos, registros de partidas e recursos de alteração e exclusão de conta.',
  introduction:
    'Estes termos descrevem os recursos e os limites de uso do PatotaFUT, mantido pela Equipe PatotaFUT para organizar o futebol do grupo.',
  sections: [
    {
      id: 'finalidade',
      title: '1. Para que serve o PatotaFUT',
      paragraphs: [
        'O PatotaFUT permite organizar eventos, confirmar presenças, formar times e reservas, administrar súmulas e acompanhar estatísticas de gols e assistências. Os registros apoiam a organização esportiva do grupo.',
      ],
    },
    {
      id: 'conta',
      title: '2. Conta e uso adequado',
      paragraphs: [
        'O acesso aos recursos do grupo exige uma conta local ou login Google. Informe dados de identificação corretos e mantenha-os atualizados. Proteja sua senha, seus códigos e sua sessão e evite compartilhar credenciais.',
        'Use as funções de acordo com seu perfil, registrando participações e lances de forma fiel. Não tente acessar contas de terceiros, contornar permissões ou interferir no funcionamento do sistema. O cadastro público cria uma conta de Jogador; não é possível escolher ou elevar a própria função nas Preferências.',
      ],
    },
    {
      id: 'perfis',
      title: '3. Perfis e limites de acesso',
      paragraphs: [
        'As permissões são cumulativas: Organizador reúne as permissões de Administrador e Jogador; Administrador reúne as de Jogador. As verificações são feitas também pela API.',
      ],
      items: [
        'Jogador: consulta eventos e estatísticas, confirma ou cancela sua presença quando permitido e acessa suas Preferências.',
        'Administrador: também administra súmulas e edita uma formação existente, com trocas e alocação manual em vagas. Pode remover uma participação de conta já alocada; a recomposição com reservas é parte dessa remoção. Não faz sorteio inicial ou incorporação geral, não gerencia eventos e não exclui contas de terceiros.',
        'Organizador: também cria e gerencia eventos, inclui convidados, faz formação, novo sorteio e incorporação, lista integrantes e pode excluir contas sob os bloqueios aplicáveis. A edição de funções de outros integrantes é prevista nas regras do projeto, mas ainda não está disponível na interface ou na API.',
      ],
    },
    {
      id: 'eventos',
      title: '4. Participação e formação dos times',
      paragraphs: [
        'A confirmação de presença é permitida em evento ativo, inclusive após o horário de início. Confirmar não significa entrar automaticamente em um time: após a formação, novos confirmados aguardam alocação. O Organizador pode incluir convidados sem conta.',
        'Enquanto não estiver alocado, o jogador pode cancelar a própria presença. Após entrar em time ou reservas, a remoção depende de Administrador ou Organizador com permissão. A remoção recompõe as vagas com as reservas existentes; se não for possível completar um time, os remanescentes passam para Reservas. Quem apenas aguarda alocação não é incluído automaticamente nesse fluxo.',
        'Somente o Organizador realiza a formação inicial, a incorporação geral e o novo sorteio. Não é permitido duplicar participantes em grupos ou exceder a quantidade por time. Eventos finalizados não podem ser reabertos.',
      ],
    },
    {
      id: 'partidas',
      title: '5. Partidas, súmulas e estatísticas',
      paragraphs: [
        'Administradores e Organizadores criam e administram as súmulas entre dois times elegíveis do mesmo evento. Uma súmula pendente revalida os times e sua composição antes do início. A escalação registrada no início é preservada mesmo quando a formação do evento muda.',
        'Gols, assistências e suas correções são registrados durante a partida, conforme as permissões e validações do sistema. A finalização preserva os registros; não há edição posterior de uma súmula finalizada. A remoção de quem integra uma escalação em andamento é bloqueada até a finalização.',
        'Placares e estatísticas derivam dos registros das partidas. Rankings e destaques usam partidas finalizadas e contas existentes; convidados contribuem para o placar, mas não para os rankings individuais. Alterar a formação ou excluir uma conta não transfere gols ou assistências a outra pessoa.',
      ],
    },
    {
      id: 'alterar',
      title: '6. Alterar os dados da conta',
      paragraphs: [
        'Todos podem editar o próprio nome e sobrenome nas Preferências, inclusive contas Google. Contas locais sem vínculo Google podem alterar e-mail com senha atual e confirmação por código no novo endereço, ou alterar senha com senha atual e confirmação da nova senha.',
        'Até a conclusão da troca de e-mail, o endereço antigo permanece válido. A troca efetiva de e-mail ou senha encerra as sessões e exige novo login. A notificação de troca de e-mail ao endereço anterior mostra somente o novo endereço parcialmente oculto e está sujeita a falhas de envio.',
        'Contas vinculadas ao Google não alteram e-mail ou senha pelas Preferências. Não são oferecidas criação de senha local ou desvinculação do Google. A recuperação de senha local é um fluxo separado, disponível para contas que já tenham uma senha local.',
      ],
    },
    {
      id: 'excluir',
      title: '7. Excluir a conta',
      paragraphs: [
        'A exclusão própria fica nas Preferências e exige sessão autenticada e confirmação em modal, sem senha, código ou nova autenticação Google. Somente o Organizador pode excluir a conta de outro integrante. A exclusão não pode deixar o grupo sem Organizador.',
        'A conta não pode ser excluída enquanto houver presença confirmada, vínculo com time ou reservas ou escalação em partida em andamento de evento ativo. Cancele a presença quando não estiver alocado, peça a remoção autorizada se estiver alocado e aguarde a finalização da partida em andamento. Eventos finalizados ou cancelados não impedem a exclusão.',
        'Concluída a exclusão, a pessoa perde o acesso e seus dados de conta e autenticação são removidos. Os registros esportivos necessários às partidas são preservados com identificação “Usuário excluído”, e a pessoa sai dos rankings e destaques individuais. Não há transferência de créditos nem alteração de placares. Novo cadastro não recupera os vínculos da conta excluída. A Política de Privacidade explica esse tratamento com mais detalhes.',
      ],
    },
    {
      id: 'disponibilidade',
      title: '8. Disponibilidade',
      paragraphs: [
        'O acesso pode sofrer interrupções, falhas, manutenção ou limitações de serviços externos, inclusive no login Google e no envio de e-mails. Não há garantia de disponibilidade contínua ou de entrega de cada mensagem. Em caso de problema, use o canal de contato. Essa informação não afasta responsabilidades previstas na legislação aplicável.',
      ],
    },
    {
      id: 'contato',
      title: '9. Contato e alterações dos termos',
      paragraphs: [
        `Dúvidas sobre os recursos, estes termos ou sua conta podem ser enviadas à ${legalSite.responsible} pelo e-mail ${legalSite.email}.`,
        'As revisões ficam disponíveis nesta página, com a data de última atualização. Não há aviso automático de alteração dos termos implementado.',
      ],
    },
  ],
};
