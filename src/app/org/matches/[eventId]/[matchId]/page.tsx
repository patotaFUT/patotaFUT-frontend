import { MatchesScreen } from '@/features/matches/components/matches-screen';
export default async function Page({
  params,
}: {
  params: Promise<{ eventId: string; matchId: string }>;
}) {
  const { eventId, matchId } = await params;
  return <MatchesScreen eventId={eventId} matchId={matchId} />;
}
