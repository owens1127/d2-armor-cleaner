import { useEffect, useRef, useState } from 'react';
import { DimIcon } from '@/components/items/DimIcon';
import {
  copyDimQueriesAnnouncement,
  copyDimQueriesAriaLabel,
  copyDimQueriesForInstances,
  copyDimQueryAnnouncement,
  copyDimQueryAriaLabel,
  copyDimQueryForInstance,
} from '@/components/items/copyDimQuery';

const COPY_FEEDBACK_MS = 2000;
/** DIM mark size inside `.ui-icon-btn` / `.ui-icon-btn--compact` (32px touch target). */
export const DIM_COPY_GLYPH_PX = 18;

function dimCopyButtonClass(compact: boolean, className: string): string {
  const buttonClass = compact
    ? 'ui-icon-btn ui-icon-btn--compact group cursor-pointer shrink-0 border border-border/80 hover:bg-white/8 hover:border-white/20'
    : 'ui-icon-btn group cursor-pointer shrink-0 border border-border/80 hover:bg-white/8 hover:border-white/20';
  return `${buttonClass} ${className}`.trim();
}

export interface CopyDimQueryButtonProps {
  instanceId: string;
  itemName: string;
  className?: string;
  /** When true, use `.ui-icon-btn--compact` (32px) for dense loadout rows. */
  compact?: boolean;
}

export function CopyDimQueryButton({
  instanceId,
  itemName,
  className = '',
  compact = false,
}: CopyDimQueryButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);
  const label = copyDimQueryAriaLabel(itemName);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleCopy(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();
    await copyDimQueryForInstance(instanceId, (text) => navigator.clipboard.writeText(text));
    setCopied(true);
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, COPY_FEEDBACK_MS);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        className={dimCopyButtonClass(compact, className)}
        aria-label={label}
        title={label}
      >
        {copied ? (
          <span className="text-[10px] font-medium leading-none text-white/90">Copied</span>
        ) : (
          <DimIcon
            size={DIM_COPY_GLYPH_PX}
            className="text-[#e8a534] opacity-90 group-hover:opacity-100"
          />
        )}
      </button>
      <span className="sr-only" aria-live="polite" role="status">
        {copied ? copyDimQueryAnnouncement(itemName) : ''}
      </span>
    </>
  );
}

export interface CopyDimQueriesButtonProps {
  instanceIds: readonly string[];
  className?: string;
  /** When true, use `.ui-icon-btn--compact` (32px) for dense loadout rows. */
  compact?: boolean;
  disabled?: boolean;
  /** Overrides default bulk aria-label and title. */
  ariaLabel?: string;
  /** Screen reader announcement after copy; defaults from ariaLabel or bulk label. */
  announcement?: string;
}

export function CopyDimQueriesButton({
  instanceIds,
  className = '',
  compact = false,
  disabled = false,
  ariaLabel,
  announcement,
}: CopyDimQueriesButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);
  const pieceCount = instanceIds.length;
  const label = ariaLabel ?? copyDimQueriesAriaLabel(pieceCount);
  const copiedAnnouncement =
    announcement ??
    (ariaLabel ? `${ariaLabel} copied to clipboard.` : copyDimQueriesAnnouncement(pieceCount));

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleCopy(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (disabled || pieceCount === 0) return;
    await copyDimQueriesForInstances(instanceIds, (text) =>
      navigator.clipboard.writeText(text),
    );
    setCopied(true);
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, COPY_FEEDBACK_MS);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        disabled={disabled || pieceCount === 0}
        className={`${dimCopyButtonClass(compact, className)} disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed`}
        aria-label={label}
        title={label}
      >
        {copied ? (
          <span className="text-[10px] font-medium leading-none text-white/90">Copied</span>
        ) : (
          <DimIcon
            size={DIM_COPY_GLYPH_PX}
            className="text-[#e8a534] opacity-90 group-hover:opacity-100"
          />
        )}
      </button>
      <span className="sr-only" aria-live="polite" role="status">
        {copied ? copiedAnnouncement : ''}
      </span>
    </>
  );
}
