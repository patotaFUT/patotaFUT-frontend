import type { TeamDto } from '../events/events.contracts';

// Presentation and selection share the same actual-count check; the API revalidates.
export function isCompleteTeam(
  team: TeamDto,
  capacity: number | null | undefined,
): boolean {
  return (
    team.type === 'TEAM' &&
    typeof capacity === 'number' &&
    Number.isSafeInteger(capacity) &&
    capacity > 0 &&
    team.members.length === capacity
  );
}
