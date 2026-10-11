import { EventsScreen } from '@/features/events/components/events-screen';
export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ manage?: string }>;
}) {
  const { eventId } = await params;
  const query = await searchParams;
  return (
    <EventsScreen eventId={eventId} manageInitially={query.manage === '1'} />
  );
}
