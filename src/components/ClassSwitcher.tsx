import { Link } from 'react-router-dom';
import { ClassIcon } from '@/components/items/ClassIcon';
import { CLASS_LABELS, CLASSES } from '@/lib/constants';
import type { ClassType } from '@/types';

type ClassRouteSegment = 'dashboard' | 'browse' | 'combos' | 'duel';

type ClassSwitcherBaseProps = {
  active: ClassType;
  className?: string;
};

type ClassSwitcherLinkProps = ClassSwitcherBaseProps & {
  mode: 'link';
  segment: ClassRouteSegment;
};

type ClassSwitcherButtonProps = ClassSwitcherBaseProps & {
  mode: 'button';
  onSelect: (classType: ClassType) => void;
};

export type ClassSwitcherProps = ClassSwitcherLinkProps | ClassSwitcherButtonProps;

function segmentClass(active: boolean) {
  return [
    'flex flex-1 min-w-0 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
    active
      ? 'border-white/20 bg-white/10 text-white'
      : 'border-transparent text-neutral-400 hover:border-white/10 hover:bg-white/5 hover:text-neutral-200',
  ].join(' ');
}

export function ClassSwitcher(props: ClassSwitcherProps) {
  const { active, className = '' } = props;

  return (
    <nav
      aria-label="Guardian class"
      className={`w-full max-w-xl ${className}`.trim()}
    >
      <div
        className="flex gap-1 rounded-lg border border-border bg-surface-2 p-1"
        role={props.mode === 'button' ? 'tablist' : undefined}
      >
        {CLASSES.map((c) => {
          const isActive = c === active;
          const content = (
            <>
              <ClassIcon classType={c} size="xs" />
              <span className="truncate">{CLASS_LABELS[c]}</span>
            </>
          );

          if (props.mode === 'link') {
            return (
              <Link
                key={c}
                to={`/${props.segment}/${c}`}
                aria-current={isActive ? 'page' : undefined}
                className={segmentClass(isActive)}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => props.onSelect(c)}
              className={segmentClass(isActive)}
            >
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
