import Image from 'next/image';
import Link from 'next/link';
import { FiArrowLeft } from 'react-icons/fi';
import { brandPresentation } from '@/config/public';
import { legalSite } from '../legal.content';
import type { LegalContent } from '../legal.content';
import { LegalLinks } from './legal-links';
import styles from './legal.module.css';

export function LegalDocument({ content }: { content: LegalContent }) {
  return (
    <main className={styles.page} tabIndex={0} aria-labelledby="legal-title">
      <div className={styles.content}>
        <Link className={styles.back} href="/">
          <FiArrowLeft aria-hidden="true" />
          Voltar ao início
        </Link>
        <header className={styles.header}>
          <Image
            src={brandPresentation.logoPath}
            alt="PatotaFUT"
            width={brandPresentation.width}
            height={brandPresentation.height}
            className={styles.logo}
          />
          <h1 id="legal-title" tabIndex={-1}>
            {content.title}
          </h1>
          <p className={styles.updated}>
            Última atualização:{' '}
            <time dateTime={legalSite.updatedAt}>{legalSite.updatedLabel}</time>
          </p>
          <p>{content.introduction}</p>
        </header>
        <nav className={styles.index} aria-label="Nesta página">
          <h2>Nesta página</h2>
          <ul>
            {content.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ul>
        </nav>
        <article className={styles.article} aria-label={content.title}>
          {content.sections.map((section) => (
            <section
              id={section.id}
              key={section.id}
              tabIndex={-1}
              aria-labelledby={`${section.id}-title`}
            >
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.items && (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
        <footer className={styles.footer}>
          <h2>Fale com a {legalSite.responsible}</h2>
          <a href={`mailto:${legalSite.email}`}>{legalSite.email}</a>
          <LegalLinks />
          <a href="#legal-title">Voltar ao título</a>
        </footer>
      </div>
    </main>
  );
}
