'use client';

import Script from 'next/script';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { googlePresentation, publicConfig } from '@/config/public';
import { authContent } from '../auth.content';
import { isRecord } from '../auth.contracts';
import styles from './google-button.module.css';

interface GoogleIdentity {
  initialize(options: {
    client_id: string;
    callback: (response: unknown) => void;
    auto_select: false;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type: 'standard';
      theme: 'filled_black';
      size: 'large';
      text: 'continue_with';
      shape: 'pill';
      logo_alignment: 'left';
      width: number;
      locale: string;
    },
  ): void;
  disableAutoSelect(): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

interface GoogleButtonProps {
  disabled: boolean;
  onCredential: (credential: string) => Promise<void>;
}

export function GoogleButton({ disabled, onCredential }: GoogleButtonProps) {
  const container = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLFieldSetElement>(null);
  const callback = useRef(onCredential);
  const inactive = useRef(disabled);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    callback.current = onCredential;
    inactive.current = disabled;
  }, [disabled, onCredential]);
  useEffect(() => {
    if (wrapper.current !== null) wrapper.current.inert = disabled;
  }, [disabled, loaded]);

  useEffect(() => {
    const parent = container.current;
    const identity = window.google?.accounts?.id;
    if (!loaded || parent === null) return;
    if (identity === undefined) {
      setFailed(true);
      return;
    }
    let active = true;
    try {
      identity.initialize({
        client_id: publicConfig.googleClientId,
        auto_select: false,
        callback(response: unknown): void {
          if (!active || inactive.current) return;
          if (
            !isRecord(response) ||
            typeof response.credential !== 'string' ||
            response.credential.length === 0
          ) {
            setFailed(true);
            return;
          }
          void callback.current(response.credential);
        },
      });
    } catch {
      active = false;
      setFailed(true);
      return;
    }
    let previousWidth = 0;
    function render(): void {
      if (parent === null) return;
      const width = Math.min(
        googlePresentation.maxWidth,
        Math.floor(parent.clientWidth),
      );
      if (width < googlePresentation.minWidth || width === previousWidth)
        return;
      previousWidth = width;
      parent.replaceChildren();
      try {
        identity?.renderButton(parent, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          width,
          locale: googlePresentation.locale,
        });
      } catch {
        parent.replaceChildren();
        setFailed(true);
      }
    }
    render();
    const observer = new ResizeObserver(render);
    observer.observe(parent);
    return (): void => {
      active = false;
      observer.disconnect();
      parent.replaceChildren();
      try {
        identity.disableAutoSelect();
      } catch {
        /* Keep local login usable even if the provider fails. */
      }
    };
  }, [loaded]);

  if (publicConfig.googleClientId.length === 0)
    return (
      <p className={styles.providerNote} role="status">
        {authContent.googleMissing}
      </p>
    );
  return (
    <div className={styles.googleAccess}>
      <Script
        src={googlePresentation.scriptUrl}
        strategy="afterInteractive"
        onReady={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      {!loaded && !failed && (
        <p className={styles.providerNote} role="status">
          {authContent.googleLoading}
        </p>
      )}
      {failed && (
        <p className={styles.providerNote} role="alert">
          {authContent.googleUnavailable}
        </p>
      )}
      <fieldset
        ref={wrapper}
        className={styles.googleButtonWrap}
        disabled={disabled}
        aria-disabled={disabled}
      >
        <div
          ref={container}
          className={styles.googleButton}
          aria-label={authContent.googleLabel}
        />
        {loaded && !failed && (
          <div className={styles.googleButtonVisual} aria-hidden="true">
            <span>{authContent.googleLabel}</span>
            <Image
              src={googlePresentation.logoPath}
              alt=""
              width={googlePresentation.logoNativeSize}
              height={googlePresentation.logoNativeSize}
              className={styles.googleBrandMark}
              unoptimized
            />
          </div>
        )}
      </fieldset>
    </div>
  );
}
