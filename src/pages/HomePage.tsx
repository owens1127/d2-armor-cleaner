import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { isBungieConfigured, startBungieLogin } from '@/lib/bungie/auth';
import { hasActiveSession, restoreMembership } from '@/lib/bungie/loadVault';
import { getOnboardingResumePath, isOnboardingComplete } from '@/lib/onboarding/storage';
import { useAuthStore, useSessionStore } from '@/stores';

const WORKFLOW_STEPS = [
  {
    step: '1',
    title: 'Sign in',
    body: 'Connect with Bungie.net so the app can read your vault. Tokens stay in your browser.',
  },
  {
    step: '2',
    title: 'Calibrate',
    body: 'Pick which stats matter and how picky you want to be about duplicates. You can change this anytime.',
  },
  {
    step: '3',
    title: 'Browse',
    body: 'Browse your tiered armor by slot and filter against your combos. Only armor you tiered in-game is included.',
  },
  {
    step: '4',
    title: 'Combos',
    body: 'See recommended five-piece loadouts and queue keep or favorite tags for pieces that fit your combos.',
  },
  {
    step: '5',
    title: 'Compare',
    body: 'Step through similar rolls in a dupe bucket and choose what to keep or junk.',
  },
  {
    step: '6',
    title: 'Review',
    body: 'Queued keep/junk tags sit in Review until you apply them in one batch to DIM.',
  },
  {
    step: '7',
    title: 'Apply',
    body: 'Sync tags to DIM, then dismantle in-game on your own schedule. Nothing is auto-deleted here.',
  },
] as const;

const FEATURES = [
  {
    title: 'Find duplicates',
    body: 'See groups of similar armor side by side and decide what to keep or junk.',
  },
  {
    title: 'Your preferences',
    body: 'Your combos shape keep and junk suggestions.',
  },
  {
    title: 'DIM tags',
    body: 'Queue keep, junk, and archive tags, then apply them in DIM when you are ready.',
  },
] as const;

export function HomePage() {
  const navigate = useNavigate();
  const { membership, setMembership } = useAuthStore();
  const pendingCount = useSessionStore((s) => s.pendingTags.length);
  const bungieReady = isBungieConfigured();
  const onboardingComplete = membership ? isOnboardingComplete() : false;
  const appEntry = onboardingComplete ? '/dashboard/hunter' : getOnboardingResumePath(false);

  function resumeSession() {
    if (!membership) {
      if (hasActiveSession()) {
        const restored = restoreMembership();
        if (restored) setMembership(restored);
      } else {
        return;
      }
    }
    navigate(isOnboardingComplete() ? '/dashboard/hunter' : getOnboardingResumePath(false));
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-12 sm:py-16 px-1">
        <p className="text-muted text-sm mb-3">Destiny 2 · Tiered armor</p>
        <h1 className="ui-heading text-4xl sm:text-5xl font-semibold tracking-tight text-white mb-3">
          D2 Armor Cleaner
        </h1>
        <p className="text-lg text-muted leading-relaxed mb-8 max-w-2xl">
          Find duplicate armor rolls, decide what to keep, queue DIM tags, and dismantle in-game on
          your own schedule.
        </p>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-14">
          {membership ? (
            <Link to={appEntry} className="ui-btn-primary px-6 py-3 text-center">
              {onboardingComplete ? 'Open dashboard' : 'Continue setup'}
            </Link>
          ) : bungieReady ? (
            <button type="button" onClick={() => startBungieLogin()} className="ui-btn-filled px-6 py-3">
              Sign in with Bungie.net
            </button>
          ) : (
            <p className="text-sm text-muted border border-border rounded-md px-4 py-3 bg-surface-2 w-full sm:w-auto">
              Add Bungie API keys to <code className="text-xs text-white/80">.env</code> to sign in and
              load your vault.
            </p>
          )}
          {pendingCount > 0 && membership && (
            <Link to="/review" className="ui-btn-filled px-6 py-3 text-center">
              Review · {pendingCount} tag{pendingCount === 1 ? '' : 's'}
            </Link>
          )}
          {!membership && bungieReady && (
            <button
              type="button"
              onClick={() => {
                resumeSession();
              }}
              className="text-sm text-muted border border-border rounded-md px-4 py-3 hover:text-white hover:border-white/20 transition-colors"
            >
              Resume previous session
            </button>
          )}
        </div>

        <section className="mb-14">
          <h2 className="ui-heading text-xl font-medium text-white mb-4">What it does</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {FEATURES.map(({ title, body }) => (
              <div key={title} className="ui-card">
                <h3 className="ui-heading text-sm font-medium text-white mb-1.5">{title}</h3>
                <p className="text-xs text-muted leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-14">
          <h2 className="ui-heading text-xl font-medium text-white mb-4">How it works</h2>
          <ol className="space-y-4">
            {WORKFLOW_STEPS.map(({ step, title, body }) => (
              <li key={step} className="flex gap-4 ui-card">
                <span
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-md border border-border text-sm text-white font-medium"
                  aria-hidden
                >
                  {step}
                </span>
                <div className="min-w-0">
                  <h3 className="ui-heading text-sm font-medium text-white mb-1">{title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <p className="text-xs text-muted/80 leading-relaxed border-t border-border pt-6">
          D2 Armor Cleaner reads your vault through Bungie.net and writes tags via DIM. It does not
          dismantle items for you. Sign out and clear data from Settings.
        </p>
      </div>
    </Layout>
  );
}
