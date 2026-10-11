import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { authContent } from '@/features/auth/auth.content';
import { brandPresentation } from '@/config/public';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};
export const metadata: Metadata = {
  title: authContent.metadataTitle,
  description: authContent.metadataDescription,
  icons: { icon: brandPresentation.logoPath },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
