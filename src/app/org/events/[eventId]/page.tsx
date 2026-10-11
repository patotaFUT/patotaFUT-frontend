import { Suspense } from 'react';
import { EventsScreen } from '@/features/events/components/events-screen';
export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <Suspense>
      <EventsScreen eventId={eventId} area="organization" view="manage" />
    </Suspense>
  );
}
