'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import styles from './events.module.css';
import { eventContent as c } from '../events.content';
// Native scroll-snap fallback: Swiper was unavailable in the restricted package cache.
export function Carousel({
  children,
  count,
  label,
}: {
  children: ReactNode;
  count: number;
  label: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [atEnd, setAtEnd] = useState(count <= 1);
  const synchronize = useCallback(() => {
    const node = track.current;
    if (node === null) return;
    const first = node.firstElementChild;
    if (!(first instanceof HTMLElement)) {
      setActive(0);
      setAtEnd(true);
      return;
    }
    let nearest = 0;
    let distance = Infinity;
    Array.from(node.children).forEach((child, index) => {
      if (child instanceof HTMLElement) {
        const delta = Math.abs(
          child.offsetLeft - first.offsetLeft - node.scrollLeft,
        );
        if (delta < distance) {
          nearest = index;
          distance = delta;
        }
      }
    });
    setActive(nearest);
    setAtEnd(node.scrollLeft + node.clientWidth >= node.scrollWidth - 2);
  }, []);
  useEffect(() => {
    const node = track.current;
    if (node === null) return;
    synchronize();
    const observer = new ResizeObserver(synchronize);
    observer.observe(node);
    Array.from(node.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [count, synchronize]);
  function move(index: number) {
    const node = track.current;
    const child = node?.children.item(index);
    const first = node?.firstElementChild;
    if (
      node !== null &&
      child instanceof HTMLElement &&
      first instanceof HTMLElement
    )
      node.scrollTo({
        left: child.offsetLeft - first.offsetLeft,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
  }
  return (
    <section
      className={styles.carousel}
      aria-label={label}
      aria-roledescription="carrossel"
    >
      <div
        ref={track}
        className={styles.track}
        tabIndex={0}
        onScroll={synchronize}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault();
            move(
              Math.max(
                0,
                Math.min(
                  count - 1,
                  active + (event.key === 'ArrowRight' ? 1 : -1),
                ),
              ),
            );
          }
        }}
      >
        {children}
      </div>
      {count > 1 && (
        <div className={styles.carouselControls}>
          <button
            type="button"
            aria-label={c.previousCard}
            disabled={active === 0}
            onClick={() => move(active - 1)}
          >
            <FiChevronLeft aria-hidden="true" />
          </button>
          {count <= 3 ? (
            <div className={styles.dots}>
              {Array.from({ length: count }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Mostrar card ${index + 1}`}
                  aria-current={index === active ? 'true' : undefined}
                  className={styles.dot}
                  onClick={() => move(index)}
                >
                  <span />
                </button>
              ))}
            </div>
          ) : (
            <span role="status" className={styles.carouselCount}>
              {active + 1} / {count}
            </span>
          )}
          <button
            type="button"
            aria-label={c.nextCard}
            disabled={atEnd || active >= count - 1}
            onClick={() => move(active + 1)}
          >
            <FiChevronRight aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
