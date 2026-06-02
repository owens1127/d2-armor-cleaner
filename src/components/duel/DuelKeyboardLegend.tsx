import { DUEL_KEY_LABELS } from '@/lib/duel/keyboard';

function GridKey({
  main,
  tone,
}: {
  main: string;
  tone: 'prefer' | 'keep' | 'junk' | 'pass';
}) {
  return (
    <span className={`duel-kbd-grid__cell duel-kbd-grid__cell--${tone}`}>
      <kbd className="ui-kbd">{main}</kbd>
    </span>
  );
}

export function DuelKeyboardLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className="duel-kbd-legend">
      <div
        className={`duel-kbd-grid${compact ? ' duel-kbd-grid--compact' : ''}`}
        aria-label="Compare keyboard shortcuts"
      >
        <span className="duel-kbd-grid__corner" aria-hidden="true" />
        <span className="duel-kbd-grid__col-header">Left</span>
        <span className="duel-kbd-grid__col-header">Both</span>
        <span className="duel-kbd-grid__col-header">Right</span>

        <span className="duel-kbd-grid__row-label">Keep</span>
        <GridKey main={DUEL_KEY_LABELS.keepLeft} tone="keep" />
        <GridKey main={DUEL_KEY_LABELS.keepBoth} tone="keep" />
        <GridKey main={DUEL_KEY_LABELS.keepRight} tone="keep" />

        <span className="duel-kbd-grid__row-label">Prefer</span>
        <GridKey main={DUEL_KEY_LABELS.preferLeft} tone="prefer" />
        <GridKey main={DUEL_KEY_LABELS.pass} tone="pass" />
        <GridKey main={DUEL_KEY_LABELS.preferRight} tone="prefer" />

        <span className="duel-kbd-grid__row-label">Junk</span>
        <GridKey main={DUEL_KEY_LABELS.junkLeft} tone="junk" />
        <GridKey main={DUEL_KEY_LABELS.junkBoth} tone="junk" />
        <GridKey main={DUEL_KEY_LABELS.junkRight} tone="junk" />
      </div>
    </div>
  );
}
