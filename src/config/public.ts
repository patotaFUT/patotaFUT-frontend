export interface PublicConfig {
  apiUrl: string;
  googleClientId: string;
}

export const publicConfig: PublicConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '',
};

export const authEndpoints = Object.freeze({
  csrf: '/auth/csrf',
  login: '/auth/login',
  register: '/auth/register',
  google: '/auth/google',
  me: '/auth/me',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  recoveryRequest: '/auth/recovery/request',
  recoveryResend: '/auth/recovery/resend',
  recoveryVerify: '/auth/recovery/verify',
  recoveryReset: '/auth/recovery/reset',
});

export const authPaths = Object.freeze({
  login: '/',
  register: '/register',
  recovery: '/forgot-password',
});

export const googlePresentation = Object.freeze({
  scriptUrl: 'https://accounts.google.com/gsi/client',
  locale: 'pt-BR',
  maxWidth: 358,
  minWidth: 200,
  logoPath: '/google-logo.png',
  logoNativeSize: 103,
});

export const brandPresentation = Object.freeze({
  logoPath: '/patotafut-logo.png',
  width: 174,
  height: 217,
});
