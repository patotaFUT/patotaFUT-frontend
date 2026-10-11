import { Suspense } from 'react';
import { EventsScreen } from '@/features/events/components/events-screen';
export default function Page() {
  return (
    <Suspense>
      <EventsScreen area="organization" />
    </Suspense>
  );
}
