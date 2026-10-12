import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { EventsScreen } from '@/features/events/components/events-screen';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ manage?: string }>;
}) {
  const { eventId } = await params;
  if ((await searchParams).manage === '1') redirect(`/org/events/${eventId}`);
  return (
    <Suspense>
      <EventsScreen eventId={eventId} />
    </Suspense>
  );
}

export const metadata: Metadata = { title: 'Times do evento' };
