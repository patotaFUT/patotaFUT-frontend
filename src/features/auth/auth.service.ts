import type { AxiosInstance, AxiosResponse } from 'axios';
import { accessRequestTimeout, accessRestoreTimeout } from './access-timing';
import { authEndpoints } from '../../config/public';
import { authContent, recoveryContent } from './auth.content';
import {
  parseRecoveryChallenge,
  parseRecoveryVerified,
  parseRecoveryComplete,
} from './recovery.contracts';
import type {
  RecoveryRequest,
  RecoveryCodeRequest,
  ResetPasswordRequest,
  RecoveryChallengeResponse,
  RecoveryVerifiedResponse,
} from './recovery.contracts';
import type { AuthCoordinator, SessionNotice } from './auth-coordinator';
import {
  parseApiError,
  parseAuthResponse,
  parseCsrfResponse,
} from './auth.contracts';
import type {
  AuthFailure,
  GoogleLoginRequest,
  LoginRequest,
  RegisterRequest,
  PublicUser,
  SessionState,
} from './auth.contracts';

export class AuthRequestError extends Error {
  constructor(public readonly failure: AuthFailure) {
    super(failure.message);
  }
}

type AuthFlow = 'local' | 'google' | 'register' | 'recovery';
function failureFor(
  response: AxiosResponse<unknown>,
  flow: AuthFlow,
): AuthFailure {
  const google = flow === 'google';
  const status = response.status;
  const body = parseApiError(response.data);
  let message: string = authContent.generic;
  if (flow === 'recovery' && status === 429) message = recoveryContent.limited;
  else if (flow === 'recovery' && status >= 500)
    message = recoveryContent.unavailable;
  else if (
    flow === 'recovery' &&
    body?.code === 'RECOVERY_AUTHORIZATION_INVALID'
  )
    message = recoveryContent.authorizationInvalid;
  else if (flow === 'recovery' && body?.code === 'RECOVERY_CODE_INVALID')
    message = recoveryContent.codeRejected;
  else if (google && body?.code === 'GOOGLE_NOT_CONFIGURED')
    message = authContent.googleMissing;
  else if (status >= 500) message = authContent.serverUnavailable;
  else if (status === 429) message = authContent.rateLimited;
  else if (status === 403) message = authContent.csrfRejected;
  else if (flow === 'register' && status === 409)
    message = authContent.registerConflict;
  else if (flow === 'register' && (status === 400 || status === 401))
    message = authContent.registerInvalid;
  else if (google && status === 409) message = authContent.googleConflict;
  else if (google && status === 400 && body?.error === 'Nome inválido.')
    message = authContent.googleIncomplete;
  else if (google && body?.code === 'GOOGLE_AUDIENCE_MISMATCH')
    message = authContent.googleAudience;
  else if (google && body?.code === 'GOOGLE_EMAIL_NOT_VERIFIED')
    message = authContent.googleUnverified;
  else if (google && status === 401) message = authContent.googleInvalid;
  else if (status === 401) message = authContent.credentialsInvalid;
  else if (status === 400) message = authContent.requestInvalid;
  return {
    kind: status === 401 ? 'authentication' : 'request',
    status,
    message,
  };
}

export function safeFailure(error: unknown): AuthFailure {
  if (error instanceof AuthRequestError) return error.failure;
  if (
    error instanceof Error &&
    error.message === authContent.browserUnsupported
  ) {
    return { kind: 'configuration', message: authContent.browserUnsupported };
  }
  return { kind: 'communication', message: authContent.communication };
}

export class AuthClient {
  private restoration: Promise<SessionState> | undefined;
  constructor(
    private readonly client: AxiosInstance,
    private readonly coordinator: AuthCoordinator,
    private readonly apiUrl: string,
  ) {}

  private configured(): void {
    if (this.apiUrl === '/api') return;
    try {
      const url = new URL(this.apiUrl);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
    } catch {
      throw new AuthRequestError({
        kind: 'configuration',
        message: authContent.configuration,
      });
    }
  }

  private async post(
    path: string,
    body:
      | LoginRequest
      | RegisterRequest
      | GoogleLoginRequest
      | RecoveryRequest
      | RecoveryCodeRequest
      | ResetPasswordRequest
      | Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<AxiosResponse<unknown>> {
    // A fresh CSRF GET + POST run under the SAME cross-tab lock. Other tabs
    // cannot replace the cookie between these requests. No CSRF persistence.
    const accessConfig =
      signal === undefined ? {} : { signal, timeout: accessRequestTimeout };
    const csrf = await this.client.get<unknown>(
      authEndpoints.csrf,
      accessConfig,
    );
    if (csrf.status !== 200)
      throw new AuthRequestError(failureFor(csrf, 'local'));
    let token: string;
    try {
      token = parseCsrfResponse(csrf.data).csrfToken;
    } catch {
      throw new AuthRequestError({
        kind: 'protocol',
        message: authContent.invalidResponse,
      });
    }
    return this.client.post<unknown>(path, body, {
      ...(path === '/account/preferences/email/request'
        ? { timeout: 30_000 }
        : {}),
      ...accessConfig,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    });
  }

  private user(
    response: AxiosResponse<unknown>,
    flow: AuthFlow = 'local',
  ): PublicUser {
    if (response.status !== (flow === 'register' ? 201 : 200))
      throw new AuthRequestError(failureFor(response, flow));
    try {
      return parseAuthResponse(response.data).user;
    } catch {
      throw new AuthRequestError({
        kind: 'protocol',
        message: authContent.invalidResponse,
      });
    }
  }

  async login(input: LoginRequest): Promise<PublicUser> {
    this.configured();
    return this.coordinator.exclusive(async () => {
      const user = this.user(await this.post(authEndpoints.login, input));
      this.coordinator.notify('session-changed');
      return user;
    });
  }

  async google(input: GoogleLoginRequest): Promise<PublicUser> {
    this.configured();
    return this.coordinator.exclusive(async () => {
      const user = this.user(
        await this.post(authEndpoints.google, input),
        'google',
      );
      this.coordinator.notify('session-changed');
      return user;
    });
  }

  async register(input: RegisterRequest): Promise<PublicUser> {
    this.configured();
    return this.coordinator.exclusive(async () => {
      // Explicit projection excludes confirmation and client-selected roles.
      const body = {
        email: input.email,
        password: input.password,
        firstName: input.firstName,
        lastName: input.lastName,
      };
      const user = this.user(
        await this.post(authEndpoints.register, body),
        'register',
      );
      this.coordinator.notify('session-changed');
      return user;
    });
  }

  restore(renew = true): Promise<SessionState> {
    if (this.restoration !== undefined) return this.restoration;
    this.restoration = this.restoreOnce(renew).finally(() => {
      this.restoration = undefined;
    });
    return this.restoration;
  }

  private async recoveryPost<T>(
    path: string,
    input: RecoveryRequest | RecoveryCodeRequest | ResetPasswordRequest,
    expected: number,
    parse: (value: unknown) => T,
  ): Promise<T> {
    this.configured();
    return this.coordinator.exclusive(async () => {
      let response: AxiosResponse<unknown>;
      try {
        response = await this.post(path, input);
      } catch (error: unknown) {
        if (error instanceof AuthRequestError) throw error;
        throw new AuthRequestError({
          kind: 'communication',
          message: recoveryContent.uncertain,
        });
      }
      if (
        path === authEndpoints.recoveryReset &&
        response.status >= 500 &&
        parseApiError(response.data)?.code !== 'RECOVERY_UNAVAILABLE'
      )
        throw new AuthRequestError({
          kind: 'request',
          status: response.status,
          message: recoveryContent.uncertain,
        });
      if (response.status !== expected)
        throw new AuthRequestError(failureFor(response, 'recovery'));
      try {
        return parse(response.data);
      } catch {
        throw new AuthRequestError({
          kind: 'protocol',
          message:
            path === authEndpoints.recoveryReset
              ? recoveryContent.uncertain
              : authContent.invalidResponse,
        });
      }
    });
  }
  requestRecovery(
    email: string,
    resend = false,
  ): Promise<RecoveryChallengeResponse> {
    return this.recoveryPost(
      resend ? authEndpoints.recoveryResend : authEndpoints.recoveryRequest,
      { email },
      202,
      parseRecoveryChallenge,
    );
  }
  verifyRecovery(
    input: RecoveryCodeRequest,
  ): Promise<RecoveryVerifiedResponse> {
    return this.recoveryPost(
      authEndpoints.recoveryVerify,
      { challengeId: input.challengeId, code: input.code },
      200,
      parseRecoveryVerified,
    );
  }
  async resetPassword(input: ResetPasswordRequest): Promise<void> {
    await this.recoveryPost(
      authEndpoints.recoveryReset,
      { password: input.password },
      200,
      parseRecoveryComplete,
    );
    this.coordinator.notify('session-ended');
  }

  private async restoreOnce(renew: boolean): Promise<SessionState> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), accessRestoreTimeout);
    const signal = controller.signal;
    const accessConfig = { signal, timeout: accessRequestTimeout };
    try {
      this.configured();
      return await this.coordinator.exclusive(
        async (): Promise<SessionState> => {
          // Read /me inside the lock too: another tab's pending read uses the
          // updated access cookie and does not rotate refresh a second time.
          let response = await this.client.get<unknown>(
            authEndpoints.me,
            accessConfig,
          );
          if (response.status === 401) {
            if (!renew) return { status: 'unauthenticated' };
            const refresh = await this.post(authEndpoints.refresh, {}, signal);
            if (refresh.status === 401) {
              this.coordinator.notify('session-ended');
              return { status: 'unauthenticated' };
            }
            this.user(refresh);
            response = await this.client.get<unknown>(
              authEndpoints.me,
              accessConfig,
            );
            if (response.status === 401) return { status: 'unauthenticated' };
          }
          return { status: 'authenticated', user: this.user(response) };
        },
        signal,
      );
    } catch (error: unknown) {
      return { status: 'error', error: safeFailure(error) };
    } finally {
      clearTimeout(timer);
    }
  }

  async logout(): Promise<void> {
    this.configured();
    await this.coordinator.exclusive(async () => {
      const response = await this.post(authEndpoints.logout, {});
      if (response.status === 401) {
        this.coordinator.notify('session-ended');
        return;
      }
      if (response.status !== 204)
        throw new AuthRequestError(failureFor(response, 'local'));
      this.coordinator.notify('session-ended');
    });
  }

  subscribe(listener: (notice: SessionNotice) => void): () => void {
    return this.coordinator.subscribe(listener);
  }

  async protectedRequest(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<AxiosResponse<unknown>> {
    this.configured();
    return this.coordinator.exclusive(async () => {
      const send = () =>
        body === undefined
          ? this.client.get<unknown>(path)
          : this.post(path, body);
      let response = await send();
      if (response.status === 401) {
        const refresh = await this.post(authEndpoints.refresh, {});
        if (refresh.status === 401) {
          this.coordinator.notify('session-ended');
          return response;
        }
        this.user(refresh);
        response = await send();
      }
      if (
        response.status >= 200 &&
        response.status < 300 &&
        body !== undefined
      ) {
        if (
          path === '/account/preferences/names' ||
          /^\/account\/members\/[^/]+\/role$/.test(path)
        )
          this.coordinator.notify('session-changed');
        if (
          [
            '/account/preferences/password',
            '/account/preferences/email/confirm',
            '/account/preferences/delete',
          ].includes(path)
        )
          this.coordinator.notify('session-ended');
      }
      return response;
    });
  }
}
