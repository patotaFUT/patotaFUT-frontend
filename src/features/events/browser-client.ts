import { authClient } from '../auth/browser-client';
import { EventsClient } from './events.service';
export const eventsClient = new EventsClient((path, body) =>
  authClient.protectedRequest(path, body),
);
