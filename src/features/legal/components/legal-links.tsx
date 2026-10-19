import Link from 'next/link';
import { legalLinks } from '../legal.content';
import styles from './legal.module.css';

export function LegalLinks() {
  return (
    <nav className={styles.links} aria-label="Documentos do PatotaFUT">
      {legalLinks.map((link) => (
        <Link key={link.href} href={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
