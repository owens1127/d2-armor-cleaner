import { Link, useLocation } from 'react-router-dom';
import { ClassIcon } from '@/components/items/ClassIcon';
import { CLASSES } from '@/lib/constants';
import { classSwitchPath } from '@/lib/nav';
import type { ClassType } from '@/types';

function pickerButtonClass(isActive: boolean): string {
  return [
    'ui-icon-btn shrink-0 cursor-pointer rounded transition-colors',
    isActive
      ? 'bg-white/10 text-white'
      : 'text-muted hover:bg-white/5 hover:text-white',
  ].join(' ');
}

function pickerIconClass(isActive: boolean): string {
  return [
    'pointer-events-none size-[1.25rem] [&_svg]:size-full',
    isActive ? 'text-white' : 'text-muted',
  ].join(' ');
}

export function HeaderClassPicker({
  active,
  onSessionClassChange,
}: {
  active: ClassType;
  onSessionClassChange: (classType: ClassType) => void;
}) {
  const location = useLocation();

  return (
    <nav
      aria-label="Guardian class"
      className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-surface/80 p-0.5"
    >
      {CLASSES.map((c) => {
        const isActive = c === active;
        const target = classSwitchPath(
          location.pathname,
          location.search,
          location.hash,
          c,
        );
        const className = pickerButtonClass(isActive);
        const icon = (
          <ClassIcon classType={c} size="xs" className={pickerIconClass(isActive)} />
        );

        if (target === null) {
          return (
            <button
              key={c}
              type="button"
              aria-pressed={isActive}
              title={c}
              onClick={() => onSessionClassChange(c)}
              className={className}
            >
              {icon}
            </button>
          );
        }

        return (
          <Link
            key={c}
            to={target}
            aria-current={isActive ? 'page' : undefined}
            title={c}
            className={className}
          >
            {icon}
          </Link>
        );
      })}
    </nav>
  );
}
