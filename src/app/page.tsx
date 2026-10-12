import type { Metadata } from 'next';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { authContent } from '@/features/auth/auth.content';

export default function Home() {
  return <AuthScreen mode="login" />;
}

export const metadata: Metadata = {
  title: { absolute: authContent.metadataTitle },
};
