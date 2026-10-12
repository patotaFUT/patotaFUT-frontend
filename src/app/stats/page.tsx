import type { Metadata } from 'next';
import { StatsScreen } from '@/features/events/components/stats-screen';
export default function Page() {
  return <StatsScreen />;
}

export const metadata: Metadata = { title: 'Estatísticas' };
