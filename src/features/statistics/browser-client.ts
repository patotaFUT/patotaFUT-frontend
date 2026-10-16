import { authClient } from '../auth/browser-client';
import { StatisticsClient } from './statistics.service';
export const statisticsClient = new StatisticsClient((path) =>
  authClient.protectedRequest(path),
);
