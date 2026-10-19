import { authClient } from '../auth/browser-client';
import { parseApiError } from '../auth/auth.contracts';

import { accountRecord } from './account.contracts';

export async function accountRequest(
  path: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await authClient.protectedRequest(`/account/${path}`, body);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      parseApiError(response.data)?.error ??
        'Não foi possível concluir. Tente novamente.',
    );
  }
  return accountRecord(response.data);
}
