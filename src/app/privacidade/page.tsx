import type { Metadata } from 'next';
import { LegalDocument } from '@/features/legal/components/legal-document';
import { legalSite, privacyContent } from '@/features/legal/legal.content';

export const metadata: Metadata = {
  title: privacyContent.title,
  description: privacyContent.description,
  alternates: { canonical: `${legalSite.origin}/privacidade` },
};
export default function PrivacyPage() {
  return <LegalDocument content={privacyContent} />;
}
