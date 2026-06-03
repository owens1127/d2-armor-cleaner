import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HeaderClassPicker } from '@/components/HeaderClassPicker';
import { MobileNav } from '@/components/MobileNav';
import { SignInWithBungieButton } from '@/components/SignInWithBungieButton';
import { SiteFooter } from '@/components/SiteFooter';
import { VaultStatusBanner } from '@/components/VaultStatusBanner';
import { BuildOptimalProvider } from '@/components/items/BuildOptimalProvider';
import { PendingTagsProvider } from '@/components/items/PendingTagsProvider';
import {
  authenticatedLandingPath,
  buildAuthenticatedNavLinks,
  isNavLinkActive,
  navClassFromPath,
  navClassFromSearch,
  signedOutNavLinks,
  type AppNavItem,
} from '@/lib/nav';
import { useVaultRefreshGuard } from '@/hooks/useVaultRefreshGuard';
import { APP_TITLE, APP_TITLE_SHORT } from '@/lib/site';
import { useAuthStore, useSessionStore } from '@/stores';

function NavLinks({
  links,
  pathname,
  pendingCount,
}: {
  links: AppNavItem[];
  pathname: string;
  pendingCount: number;
}) {
  const { t } = useTranslation('nav');

  return (
    <>
      {links.map(({ to, labelKey, match }) => (
        <Link
          key={labelKey}
          to={to}
          className={`ui-nav-link px-3.5 py-2.5 rounded-md relative transition-colors ${
            isNavLinkActive(pathname, { match })
              ? 'text-white bg-white/10'
              : 'text-muted hover:text-white'
          }`}
        >
          {t(labelKey)}
          {match === '/review' && pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-white text-surface text-[10px] font-bold px-1">
              {pendingCount}
            </span>
          )}
        </Link>
      ))}
    </>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  useVaultRefreshGuard();
  const location = useLocation();
  const { membership } = useAuthStore();
  const pendingCount = useSessionStore((s) => s.pendingTags.length);
  const activeNavClass = useSessionStore((s) => s.activeNavClass);
  const setActiveNavClass = useSessionStore((s) => s.setActiveNavClass);
  const pathClass =
    navClassFromPath(location.pathname) ?? navClassFromSearch(location.search);

  useEffect(() => {
    if (pathClass) setActiveNavClass(pathClass);
  }, [pathClass, setActiveNavClass]);

  const navLinks = membership
    ? buildAuthenticatedNavLinks(activeNavClass)
    : signedOutNavLinks();
  return (
    <div className="min-h-full flex flex-col overflow-x-hidden">
      <VaultStatusBanner />
      <header className="border-b border-border/80 bg-surface-2/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to={membership ? authenticatedLandingPath(activeNavClass) : '/'}
              className="ui-heading font-semibold text-white tracking-tight text-sm sm:text-base shrink-0"
            >
              <span className="sm:hidden">{APP_TITLE_SHORT}</span>
              <span className="hidden sm:inline">{APP_TITLE}</span>
            </Link>
            {membership && (
              <HeaderClassPicker
                active={activeNavClass}
                onSessionClassChange={setActiveNavClass}
              />
            )}
          </div>
          <nav className="hidden md:flex items-center gap-0.5">
            <NavLinks
              links={navLinks}
              pathname={location.pathname}
              pendingCount={pendingCount}
            />
          </nav>
          <div className="shrink-0 text-sm">
            {membership ? (
              <span className="text-muted truncate max-w-[10rem] sm:max-w-none">
                {membership.displayName}
              </span>
            ) : (
              <SignInWithBungieButton className="ui-btn-primary px-3.5 py-1.5 text-xs font-medium" />
            )}
          </div>
        </div>
        <div className="ui-divider max-w-7xl mx-auto" />
      </header>
      <main className="flex flex-1 flex-col min-h-0 max-w-7xl w-full mx-auto px-4 py-6 pb-20 md:pb-6 min-w-0">
        <BuildOptimalProvider>
          <PendingTagsProvider>{children}</PendingTagsProvider>
        </BuildOptimalProvider>
      </main>
      <SiteFooter />
      <MobileNav />
    </div>
  );
}
