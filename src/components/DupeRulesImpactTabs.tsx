import { useState } from 'react';
import { CLASSES } from '@/lib/constants';
import { DupeRulesImpact } from '@/components/DupeRulesImpact';
import type { ClassType, DupeRuleConfig } from '@/types';

interface DupeRulesImpactTabsProps {
  rules: DupeRuleConfig;
  plainLanguage?: boolean;
}

export function DupeRulesImpactTabs({ rules, plainLanguage }: DupeRulesImpactTabsProps) {
  const [classType, setClassType] = useState<ClassType>('hunter');

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {CLASSES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setClassType(c)}
            aria-pressed={classType === c}
            className={`px-3 py-1 rounded-md text-sm capitalize transition-colors ${
              classType === c
                ? 'bg-white/10 text-white ring-1 ring-white/20'
                : 'text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className={plainLanguage ? 'min-h-[4.5rem]' : undefined}>
        <DupeRulesImpact rules={rules} classType={classType} plainLanguage={plainLanguage} />
      </div>
    </div>
  );
}
