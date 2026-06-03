import { useTranslation } from 'react-i18next';
import { duelKeyLabelCopy } from '@/i18n/duelCopy';

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
  const { t } = useTranslation('duel');

  return (
    <div className="duel-kbd-legend">
      <div
        className={`duel-kbd-grid${compact ? ' duel-kbd-grid--compact' : ''}`}
        aria-label={t('keyboard.aria')}
      >
        <span className="duel-kbd-grid__corner" aria-hidden="true" />
        <span className="duel-kbd-grid__col-header">{t('keyboard.left')}</span>
        <span className="duel-kbd-grid__col-header">{t('keyboard.both')}</span>
        <span className="duel-kbd-grid__col-header">{t('keyboard.right')}</span>

        <span className="duel-kbd-grid__row-label">{t('keyboard.keep')}</span>
        <GridKey main={duelKeyLabelCopy('keepLeft')} tone="keep" />
        <GridKey main={duelKeyLabelCopy('keepBoth')} tone="keep" />
        <GridKey main={duelKeyLabelCopy('keepRight')} tone="keep" />

        <span className="duel-kbd-grid__row-label">{t('keyboard.prefer')}</span>
        <GridKey main={duelKeyLabelCopy('preferLeft')} tone="prefer" />
        <GridKey main={duelKeyLabelCopy('pass')} tone="pass" />
        <GridKey main={duelKeyLabelCopy('preferRight')} tone="prefer" />

        <span className="duel-kbd-grid__row-label">{t('keyboard.junk')}</span>
        <GridKey main={duelKeyLabelCopy('junkLeft')} tone="junk" />
        <GridKey main={duelKeyLabelCopy('junkBoth')} tone="junk" />
        <GridKey main={duelKeyLabelCopy('junkRight')} tone="junk" />
      </div>
    </div>
  );
}
