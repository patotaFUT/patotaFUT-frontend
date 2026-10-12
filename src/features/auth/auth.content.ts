import type { UserRole } from './auth.contracts';

export const authContent = Object.freeze({
  title: 'Login',
  metadataTitle: 'Login | PatotaFUT',
  metadataDescription: 'Acesse sua conta PatotaFUT.',
  logo: 'PatotaFUT',
  accountQuestion: 'Não tem uma conta?',
  register: 'Registre-se',
  registerTitle: 'Crie sua conta',
  registerMetadataTitle: 'Registre-se | PatotaFUT',
  registerMetadataDescription: 'Crie sua conta PatotaFUT.',
  existingAccount: 'Já tem uma conta?',
  firstName: 'Nome',
  firstNamePlaceholder: 'Digite seu nome',
  lastName: 'Sobrenome',
  lastNamePlaceholder: 'Digite seu sobrenome',
  confirmPassword: 'Confirmar senha',
  confirmPasswordPlaceholder: 'Digite a senha novamente',
  showConfirmation: 'Mostrar confirmação de senha',
  hideConfirmation: 'Ocultar confirmação de senha',
  createAccount: 'Criar conta',
  creatingAccount: 'Criando conta…',
  registered: 'Conta criada. Sua sessão está autenticada.',
  firstNameInvalid: 'Informe seu nome, com até 100 caracteres.',
  lastNameInvalid: 'Informe seu sobrenome, com até 100 caracteres.',
  passwordTooShort: 'A senha deve ter pelo menos 12 caracteres.',
  passwordHint: 'Use pelo menos 12 caracteres, com no máximo 1024 bytes.',
  confirmationRequired: 'Confirme sua senha.',
  confirmationMismatch: 'As senhas não coincidem.',
  registerConflict:
    'Este e-mail já está cadastrado. Use o acesso da conta existente.',
  registerInvalid: 'Não foi possível cadastrar. Confira os dados informados.',
  forgotPassword: 'Esqueci minha senha',
  email: 'E-mail',
  emailPlaceholder: 'Digite seu email',
  password: 'Senha',
  passwordPlaceholder: 'Digite sua senha',
  showPassword: 'Mostrar senha',
  hidePassword: 'Ocultar senha',
  enter: 'Entrar',
  entering: 'Entrando…',
  separator: 'Ou',
  googleLabel: 'Continuar com o Google',
  googleLoading: 'Carregando acesso com Google…',
  googleMissing: 'Login Google indisponível: Client ID não configurado.',
  googleUnavailable:
    'Não foi possível carregar o Google. Use o login com e-mail ou tente novamente.',
  googleIncomplete:
    'O Google não forneceu nome e sobrenome necessários. A complementação do cadastro não está disponível nesta etapa.',
  googleInvalid:
    'Não foi possível validar sua identidade Google. Tente novamente.',
  googleAudience:
    'O login Google precisa de ajuste no Client ID do frontend e da API.',
  googleUnverified: 'Use uma conta Google com e-mail verificado.',
  googleConflict:
    'Essa conta exige confirmação de vinculação ou alteração de e-mail, ainda indisponível.',
  checking: 'Verificando sua sessão…',
  authenticated: 'Login realizado. Sua sessão está autenticada.',
  restored: 'Sua sessão está autenticada.',
  sessionEnded: 'Sua sessão terminou. Entre novamente.',
  signOut: 'Sair',
  signingOut: 'Saindo…',
  retry: 'Tentar novamente',
  emailInvalid: 'Informe um e-mail válido.',
  passwordRequired: 'Informe sua senha.',
  passwordTooLong: 'A senha ultrapassa o limite de 1024 bytes.',
  credentialsInvalid: 'E-mail ou senha incorretos.',
  requestInvalid: 'Confira os dados informados e tente novamente.',
  csrfRejected:
    'Não foi possível validar a segurança da requisição. Tente novamente; se persistir, confira a origem permitida e os cookies da API.',
  rateLimited:
    'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.',
  communication:
    'Não foi possível conectar à API. Verifique sua conexão e tente novamente.',
  serverUnavailable: 'A API está indisponível. Tente novamente em instantes.',
  invalidResponse: 'A API retornou uma resposta inesperada. Tente novamente.',
  configuration: 'O serviço está indisponível. Tente novamente em instantes.',
  browserUnsupported:
    'Este navegador não oferece a coordenação segura entre abas. Use um navegador atualizado em HTTPS ou localhost.',
  generic: 'Não foi possível concluir a operação. Tente novamente.',
  roleLabel: 'Função',
});

export const roleLabels: Readonly<Record<UserRole, string>> = {
  PLAYER: 'Jogador',
  ADMIN: 'Administrador',
  ORGANIZER: 'Organizador',
};

export const recoveryContent = Object.freeze({
  metadataTitle: 'Recupere sua senha | PatotaFUT',
  metadataDescription: 'Recupere o acesso local à sua conta PatotaFUT.',
  emailTitle: 'Esqueci minha senha',
  codeTitle: 'Confira seu e-mail',
  passwordTitle: 'Nova senha',
  completeTitle: 'Senha alterada',
  introduction: 'Informe seu e-mail para solicitar um código de recuperação.',
  generic:
    'Se houver uma conta elegível, enviaremos as instruções de recuperação.',
  codeHelp:
    'Use o código de 8 dígitos. Ele expira em 10 minutos. O envio pode levar alguns instantes; confira também o spam. Contas exclusivamente Google devem usar o acesso Google.',
  code: 'Código de recuperação',
  codePlaceholder: 'Digite os 8 dígitos',
  codeInvalid: 'Informe os 8 dígitos do código, incluindo os zeros iniciais.',
  codeRejected:
    'Código inválido, expirado ou indisponível. Confira o e-mail ou solicite outro código.',
  request: 'Solicitar código',
  requesting: 'Solicitando…',
  verify: 'Validar código',
  verifying: 'Validando…',
  resend: 'Solicitar outro código',
  resending: 'Solicitando outro código…',
  resendCountdown: 'Novo código disponível em',
  seconds: 's',
  restart: 'Usar outro e-mail ou recomeçar',
  newPassword: 'Nova senha',
  newPasswordPlaceholder: 'Digite sua nova senha',
  passwordHelp:
    'A autorização expira em 5 minutos. Defina sua nova senha para concluir.',
  reset: 'Alterar senha',
  resetting: 'Alterando senha…',
  complete:
    'Sua senha foi alterada e as sessões anteriores foram invalidadas. Entre com sua nova senha.',
  back: 'Voltar ao login',
  authorizationInvalid:
    'A autorização expirou ou já foi utilizada. Se uma tentativa anterior teve falha de conexão, tente entrar com a nova senha antes de recomeçar.',
  limited: 'Muitas tentativas. Aguarde antes de tentar novamente.',
  unavailable:
    'Recuperação temporariamente indisponível. Tente novamente mais tarde.',
  uncertain:
    'Não foi possível confirmar a operação. Ela não será repetida automaticamente. Se estava alterando a senha, tente entrar com a nova senha antes de recomeçar.',
});
