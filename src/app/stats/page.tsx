import type { Metadata } from 'next';
import { StatsScreen } from '@/features/statistics/components/stats-screen';
export default function Page() {
  return <StatsScreen />;
}

export const metadata: Metadata = { title: 'Estatísticas' };
