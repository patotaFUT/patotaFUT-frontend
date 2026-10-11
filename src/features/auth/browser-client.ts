import { publicConfig } from '@/config/public';
import { http } from '@/lib/http/client';
import { createBrowserCoordinator } from './auth-coordinator';
import { AuthClient } from './auth.service';

export const authClient = new AuthClient(
  http,
  createBrowserCoordinator(publicConfig.apiUrl),
  publicConfig.apiUrl,
);
