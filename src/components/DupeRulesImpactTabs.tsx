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
            className={`px-3 py-1 rounded-md text-sm capitalize ${
              classType === c ? 'bg-white/10' : 'text-muted hover:text-white'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <DupeRulesImpact rules={rules} classType={classType} plainLanguage={plainLanguage} />
    </div>
  );
}
