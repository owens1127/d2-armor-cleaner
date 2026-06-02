import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollToHashElement } from '@/lib/nav/hashScroll';

const HASH_SCROLL_MAX_ATTEMPTS = 24;
const HASH_SCROLL_RETRY_MS = 50;

/** Scroll to `location.hash` after mount or hash change (SPA navigation). */
export function useScrollToLocationHash(): void {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) return;
    let attempts = 0;
    let timer = 0;
    const tryScroll = () => {
      const raw = hash.replace(/^#/, '');
      const id = raw === 'desired-builds' ? 'combos' : raw;
      if (id && document.getElementById(id)) {
        scrollToHashElement(hash);
        return;
      }
      if (attempts++ < HASH_SCROLL_MAX_ATTEMPTS) {
        timer = window.setTimeout(tryScroll, HASH_SCROLL_RETRY_MS);
      }
    };
    timer = window.setTimeout(tryScroll, HASH_SCROLL_RETRY_MS);
    return () => window.clearTimeout(timer);
  }, [hash, pathname]);
}
