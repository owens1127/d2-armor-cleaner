import type { ReactNode } from 'react';

type OnboardingBackButtonProps = {
  onClick: () => void;
  /** Text link (top of page) or bordered secondary button (footer nav). */
  variant?: 'text' | 'secondary';
  className?: string;
  label?: string;
};

export function OnboardingBackButton({
  onClick,
  variant = 'text',
  className = '',
  label = 'Back',
}: OnboardingBackButtonProps) {
  if (variant === 'secondary') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`ui-btn-secondary px-5 py-2.5 text-sm ${className}`.trim()}
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Go back"
      className={`text-sm text-muted hover:text-white mb-6 ${className}`.trim()}
    >
      {label}
    </button>
  );
}

type OnboardingStepActionsProps = {
  onBack?: () => void;
  backLabel?: string;
  onSkip?: () => void;
  skipLabel?: string;
  children?: ReactNode;
  className?: string;
};

/** Footer row: Back on the left; optional primary action beside it, Skip on the right. */
export function OnboardingStepActions({
  onBack,
  backLabel = 'Back',
  onSkip,
  skipLabel = 'Skip',
  children,
  className = '',
}: OnboardingStepActionsProps) {
  return (
    <div className={`mt-8 flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}>
      <div className="flex flex-wrap items-center gap-3">
        {onBack && (
          <OnboardingBackButton onClick={onBack} variant="secondary" label={backLabel} />
        )}
        {children}
      </div>
      {onSkip && (
        <button type="button" onClick={onSkip} className="text-sm text-muted hover:text-white">
          {skipLabel}
        </button>
      )}
    </div>
  );
}
