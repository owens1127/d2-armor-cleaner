import { isBungieConfigured, startBungieLogin } from '@/lib/bungie/auth';
import { bungieSignInUnavailableMessage } from '@/lib/env';

type SignInWithBungieButtonProps = {
  className?: string;
  /** Show a short note when sign-in is not configured on this build */
  showUnavailableNote?: boolean;
};

export function SignInWithBungieButton({
  className = 'ui-btn-primary px-5 py-2.5 text-sm font-medium',
  showUnavailableNote = false,
}: SignInWithBungieButtonProps) {
  const bungieReady = isBungieConfigured();

  return (
    <div className="flex flex-col items-stretch gap-2">
      <button
        type="button"
        disabled={!bungieReady}
        onClick={() => startBungieLogin()}
        className={className}
        aria-describedby={
          showUnavailableNote && !bungieReady ? 'bungie-sign-in-unavailable' : undefined
        }
      >
        Sign in with Bungie
      </button>
      {showUnavailableNote && !bungieReady && (
        <p
          id="bungie-sign-in-unavailable"
          className="text-xs text-muted leading-relaxed max-w-sm"
        >
          {bungieSignInUnavailableMessage()}
        </p>
      )}
    </div>
  );
}
