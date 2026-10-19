import type { Metadata } from 'next';
import { LegalDocument } from '@/features/legal/components/legal-document';
import { legalSite, termsContent } from '@/features/legal/legal.content';

export const metadata: Metadata = {
  title: termsContent.title,
  description: termsContent.description,
  alternates: { canonical: `${legalSite.origin}/termos` },
};
export default function TermsPage() {
  return <LegalDocument content={termsContent} />;
}
