import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  buildAuthenticatedNavLinks,
  isNavLinkActive,
  signedOutNavLinks,
  type NavLabelKey,
} from '@/lib/nav';
import { useAuthStore, useSessionStore } from '@/stores';

function mobileNavLabel(t: TFunction<'nav'>, labelKey: NavLabelKey): string {
  const full = t(labelKey);
  return t(`mobile.${labelKey}`, { defaultValue: full });
}

export function MobileNav() {
  const location = useLocation();
  const { t } = useTranslation('nav');
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
      aria-label={t('aria.mobile')}
    >
      <div className="flex items-stretch h-16 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {navLinks.map(({ to, labelKey, match }) => {
          const active = isNavLinkActive(location.pathname, { match });
          return (
            <Link
              key={labelKey}
              to={to}
              className={`flex flex-1 min-w-[3.25rem] max-w-[5rem] flex-col items-center justify-center gap-0.5 text-[10px] sm:text-xs px-2 py-2 relative touch-manipulation min-h-11 ${
                active ? 'text-white' : 'text-muted'
              }`}
            >
              {mobileNavLabel(t, labelKey)}
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
