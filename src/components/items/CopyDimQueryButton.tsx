import { useEffect, useRef, useState } from 'react';
import { DimIcon } from '@/components/items/DimIcon';
import {
  copyDimQueryAnnouncement,
  copyDimQueryAriaLabel,
  copyDimQueryForInstance,
} from '@/components/items/copyDimQuery';

const COPY_FEEDBACK_MS = 2000;
/** Slightly larger than tag glyphs so the DIM mark reads at 32px button size. */
const DIM_COPY_GLYPH_PX = 18;

export interface CopyDimQueryButtonProps {
  instanceId: string;
  itemName: string;
  className?: string;
  /** When true, use compact icon styling for dense rows (slot picker, review table). */
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

  const buttonClass = compact
    ? 'ui-icon-btn ui-icon-btn--compact group cursor-pointer shrink-0 border border-border/80 hover:bg-white/8 hover:border-white/20'
    : 'ui-icon-btn group cursor-pointer shrink-0 border border-border/80 hover:bg-white/8 hover:border-white/20';

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        className={`${buttonClass} ${className}`.trim()}
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
