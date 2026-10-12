import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EventsScreen } from '@/features/events/components/events-screen';
export default function Page() {
  return (
    <Suspense>
      <EventsScreen />
    </Suspense>
  );
}

export const metadata: Metadata = { title: 'Eventos ativos' };
