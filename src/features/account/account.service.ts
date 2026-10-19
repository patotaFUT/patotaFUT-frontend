import { authClient } from '../auth/browser-client';
import { parseApiError } from '../auth/auth.contracts';

import { accountRecord } from './account.contracts';

export class AccountRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function accountRequest(
  path: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await authClient.protectedRequest(`/account/${path}`, body);
  if (response.status < 200 || response.status >= 300) {
    throw new AccountRequestError(
      parseApiError(response.data)?.error ??
        'Não foi possível concluir. Tente novamente.',
      response.status,
    );
  }
  return accountRecord(response.data);
}
