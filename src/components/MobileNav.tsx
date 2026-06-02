import { Link, useLocation } from 'react-router-dom';
import {
  buildAuthenticatedNavLinks,
  isNavLinkActive,
  signedOutNavLinks,
} from '@/lib/nav';
import { useAuthStore, useSessionStore } from '@/stores';

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
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-surface-2/95 backdrop-blur">
      <div className="flex justify-around items-center h-16">
        {navLinks.map(({ to, label, match }) => {
          const active = isNavLinkActive(location.pathname, { label, match, to });
          return (
            <Link
              key={label}
              to={to}
              className={`flex flex-col items-center justify-center text-xs px-3 py-2 relative min-w-[3.5rem] ${
                active ? 'text-white' : 'text-muted'
              }`}
            >
              {label}
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
