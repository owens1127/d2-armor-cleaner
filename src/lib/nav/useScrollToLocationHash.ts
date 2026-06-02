import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { normalizeHashTargetId, scrollToHashElement } from '@/lib/nav/hashScroll';

const HASH_SCROLL_MAX_ATTEMPTS = 24;
const HASH_SCROLL_RETRY_MS = 50;

/** Scroll to `location.hash` after mount or hash change (SPA navigation). */
export function useScrollToLocationHash(): void {
  const { hash, pathname, search } = useLocation();
  const navigate = useNavigate();
  const lastScrolledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hash) return;
    const scrollKey = `${pathname}${search}${hash}`;
    if (lastScrolledKeyRef.current === scrollKey) return;

    let attempts = 0;
    let timer = 0;
    const tryScroll = () => {
      const id = normalizeHashTargetId(hash);
      if (id && document.getElementById(id)) {
        scrollToHashElement(hash);
        lastScrolledKeyRef.current = scrollKey;
        navigate({ pathname, search }, { replace: true, preventScrollReset: true });
        return;
      }
      if (attempts++ < HASH_SCROLL_MAX_ATTEMPTS) {
        timer = window.setTimeout(tryScroll, HASH_SCROLL_RETRY_MS);
      }
    };
    timer = window.setTimeout(tryScroll, HASH_SCROLL_RETRY_MS);
    return () => window.clearTimeout(timer);
  }, [hash, pathname, search, navigate]);
}
