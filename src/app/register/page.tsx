import type { Metadata } from 'next';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { authContent } from '@/features/auth/auth.content';

export const metadata: Metadata = {
  title: authContent.registerMetadataTitle,
  description: authContent.registerMetadataDescription,
};

export default function RegisterPage() {
  return <AuthScreen mode="register" />;
}
