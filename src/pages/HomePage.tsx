import { Navigate, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { SignInWithBungieButton } from '@/components/SignInWithBungieButton';
import { isBungieConfigured } from '@/lib/bungie/auth';
import { hasActiveSession, restoreMembership } from '@/lib/bungie/loadVault';
import { authenticatedLandingPath } from '@/lib/nav';
import { useAuthStore, useSessionStore } from '@/stores';

export function HomePage() {
  const navigate = useNavigate();
  const { membership, setMembership } = useAuthStore();
  const activeNavClass = useSessionStore((s) => s.activeNavClass);

  if (membership) {
    return <Navigate to={authenticatedLandingPath(activeNavClass)} replace />;
  }

  const bungieReady = isBungieConfigured();
  const canResumeSession = bungieReady && hasActiveSession();

  function resumeSession() {
    if (hasActiveSession()) {
      const restored = restoreMembership();
      if (restored) setMembership(restored);
    }
    navigate(authenticatedLandingPath(activeNavClass));
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto py-6 sm:py-8">
        <header className="mb-8">
          <h1 className="ui-heading text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            D2 Armor Cleaner
          </h1>
          <p className="mt-2 text-sm text-muted leading-relaxed max-w-md">
            Compare duplicate armor and queue DIM tags. Nothing is dismantled here.
          </p>
        </header>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-10">
          <SignInWithBungieButton
            className="ui-btn-primary px-5 py-2.5 text-sm font-medium w-full sm:w-auto"
            showUnavailableNote
          />
          {canResumeSession && (
            <button
              type="button"
              onClick={() => resumeSession()}
              className="text-xs text-muted hover:text-white transition-colors self-start sm:self-center"
            >
              Resume previous session
            </button>
          )}
        </div>

        <p className="text-xs text-muted leading-relaxed pt-6 border-t border-border/60">
          Vault via Bungie.net. Tags via DIM. Sign out in Settings.
        </p>
      </div>
    </Layout>
  );
}
