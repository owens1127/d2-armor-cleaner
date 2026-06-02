import {
  FOOTER_NAV_LINKS,
  KOFI_BADGE_SRC,
  KOFI_URL,
  SITE_AUTHOR,
} from '@/lib/siteLinks';

const linkClass =
  'text-muted hover:text-white transition-colors underline-offset-2 hover:underline';

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border/60 bg-surface">
      <div className="max-w-7xl mx-auto px-4 py-5 pb-20 md:pb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted order-3 sm:order-1">
          &copy; {year} {SITE_AUTHOR}
        </p>

        <nav
          className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs order-1 sm:order-2 sm:justify-center"
          aria-label="Site links"
        >
          {FOOTER_NAV_LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              {label}
            </a>
          ))}
        </nav>

        <a
          href={KOFI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="order-2 sm:order-3 shrink-0 self-start sm:self-center opacity-90 hover:opacity-100 transition-opacity"
          aria-label="Support on Ko-fi"
        >
          <img
            src={KOFI_BADGE_SRC}
            alt="Support on Ko-fi"
            width={160}
            height={27}
            className="h-7 w-auto max-w-[10rem] border-0"
            loading="lazy"
            decoding="async"
          />
        </a>
      </div>
    </footer>
  );
}
