import { Link, useLocation } from 'react-router-dom';
import {
  buildAuthenticatedNavLinks,
  isNavLinkActive,
  signedOutNavLinks,
} from '@/lib/nav';
import { useAuthStore, useSessionStore } from '@/stores';

/** Short labels so eight links fit narrow viewports without clipping. */
const MOBILE_NAV_LABEL: Record<string, string> = {
  Dashboard: 'Dash',
  Calibrate: 'Cal',
  'Auto filters': 'Filters',
  Settings: 'Set',
};

export function MobileNav() {
  const location = useLocation();
  const { membership } = useAuthStore();
  const pendingCount = useSessionStore((s) => s.pendingTags.length);
  const activeNavClass = useSessionStore((s) => s.activeNavClass);

  const navLinks = membership
    ? buildAuthenticatedNavLinks(activeNavClass)
    : signedOutNavLinks();

  if (!membership && navLinks.length <= 1) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-surface-2/95 backdrop-blur pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch h-16 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {navLinks.map(({ to, label, match }) => {
          const active = isNavLinkActive(location.pathname, { label, match, to });
          const mobileLabel = MOBILE_NAV_LABEL[label] ?? label;
          return (
            <Link
              key={label}
              to={to}
              className={`flex flex-1 min-w-[3.25rem] max-w-[5rem] flex-col items-center justify-center gap-0.5 text-[10px] sm:text-xs px-2 py-2 relative touch-manipulation min-h-11 ${
                active ? 'text-white' : 'text-muted'
              }`}
            >
              {mobileLabel}
              {match === '/review' && pendingCount > 0 && (
                <span className="absolute top-0 right-0 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-accent text-surface text-[9px] font-bold">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
