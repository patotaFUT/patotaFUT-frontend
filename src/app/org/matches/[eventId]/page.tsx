import { MatchesScreen } from '@/features/matches/components/matches-screen';
export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <MatchesScreen eventId={eventId} />;
}
