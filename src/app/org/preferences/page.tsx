import type { Metadata } from 'next';
import { OrganizationScreen } from '@/features/organization/components/organization-screen';
export default function Page() {
  return <OrganizationScreen page="preferences" />;
}
export const metadata: Metadata = { title: 'Preferências' };
