import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EventsScreen } from '@/features/events/components/events-screen';
export const metadata: Metadata = { title: 'Editar times' };
export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <Suspense>
      <EventsScreen eventId={eventId} area="organization" view="editTeams" />
    </Suspense>
  );
}
