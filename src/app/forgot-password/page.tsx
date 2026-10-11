import type { Metadata } from 'next';
import { RecoveryScreen } from '@/features/auth/components/recovery-screen';
import { recoveryContent } from '@/features/auth/auth.content';

export const metadata: Metadata = {
  title: recoveryContent.metadataTitle,
  description: recoveryContent.metadataDescription,
};
export default function ForgotPasswordPage() {
  return <RecoveryScreen />;
}
