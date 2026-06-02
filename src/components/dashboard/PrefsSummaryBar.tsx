import { Link } from 'react-router-dom';
import { STAT_LABELS, STATS } from '@/lib/constants';
import {
  getCalibrationChoiceCount,
  getCalibrationConfidence,
} from '@/lib/prefs/calibrationChoices';
import { getClassPrefs } from '@/lib/prefs/profile';
import type { ClassType, PreferenceProfile } from '@/types';

export function PrefsSummaryBar({
  profile,
  classType,
}: {
  profile: PreferenceProfile;
  classType: ClassType;
}) {
  const classPrefs = getClassPrefs(profile, classType);
  const topStat = [...STATS].sort(
    (a, b) => (classPrefs.statWeights[b] ?? 0) - (classPrefs.statWeights[a] ?? 0),
  )[0];
  const confidence = getCalibrationConfidence(classPrefs);
  const choiceCount = getCalibrationChoiceCount(classPrefs);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted mb-6 py-2 px-3 rounded-lg border border-border bg-surface-2/50">
      <span>
        Top stat: <span className="text-white">{STAT_LABELS[topStat]}</span>
      </span>
      <span>
        Prefs:{' '}
        <span
          className={
            confidence === 'high'
              ? 'text-accent-dim'
              : confidence === 'medium'
                ? 'text-white'
                : 'text-muted'
          }
        >
          {confidence} confidence
        </span>
        {' · '}
        {choiceCount === 1 ? '1 calibration' : `${choiceCount} calibrations`}
      </span>
      {confidence !== 'high' && (
        <Link
          to={`/onboarding/calibrate?class=${classType}`}
          className="text-white hover:underline"
        >
          Recalibrate {classType} →
        </Link>
      )}
    </div>
  );
}
