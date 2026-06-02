import {
  DIM_TAG_DEFINITIONS,
  tagActionIconBtnClass,
  TAG_ACTION_GLYPH_PX,
  type TagActionKind,
} from '@/lib/dim/tagConfig';

function TagActionGlyph({ tag, px = TAG_ACTION_GLYPH_PX }: { tag: TagActionKind; px?: number }) {
  const def = DIM_TAG_DEFINITIONS[tag];
  return (
    <svg width={px} height={px} viewBox="0 0 512 512" aria-hidden className="block shrink-0">
      <path fill="currentColor" d={def.svgPath} />
    </svg>
  );
}

export interface TagActionButtonProps {
  tag: TagActionKind;
  active: boolean;
  /** Applied in DIM but not removable from this control (favorite). */
  locked?: boolean;
  disabled?: boolean;
  compact?: boolean;
  title: string;
  onClick: () => void;
}

export function TagActionButton({
  tag,
  active,
  locked,
  disabled,
  compact,
  title,
  onClick,
}: TagActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={locked || disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={tagActionIconBtnClass(tag, active, { locked, compact })}
    >
      <TagActionGlyph tag={tag} px={compact ? 14 : TAG_ACTION_GLYPH_PX} />
    </button>
  );
}
