import { useState, type ReactNode } from 'react';
import { parseSetBonusTargets } from '@/lib/coverage/setBonus';
import { armorSetIconUrls, resolveArmorSetIcons } from '@/lib/items/setIcons';
import type { ArmorPiece, ArmorSetInfo } from '@/types';

type ArmorSetIconSize = 'sm' | 'md';

interface ArmorSetIconsProps {
  setHash: number;
  setInfo?: ArmorSetInfo;
  items?: ArmorPiece[];
  size?: ArmorSetIconSize;
  /** Max perk icons (1 for compact tabs, 2 for 2pc+4pc like tier5.report). */
  maxIcons?: number;
  /** When set, only show the 2pc or 4pc tier icon (combo tabs use one icon per target). */
  piecesTier?: 2 | 4;
  className?: string;
}

const SIZE = {
  sm: 16,
  md: 20,
} as const;

function SetIconFallback({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
      className="text-white/40"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

function SetIconGlyph({
  src,
  size,
  title,
}: {
  src: string;
  size: number;
  title?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <SetIconFallback size={size} />;
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      title={title}
      className="block w-full h-full object-cover brightness-0 invert opacity-85"
      aria-hidden={!title}
      onError={() => setFailed(true)}
    />
  );
}

/** Circular set bonus icons from Bungie sandbox perk art (2pc/4pc), tier5-style. */
export function ArmorSetIcons({
  setHash,
  setInfo,
  items = [],
  size = 'sm',
  maxIcons = 2,
  piecesTier,
  className = '',
}: ArmorSetIconsProps) {
  const px = SIZE[size];
  let entries = resolveArmorSetIcons(setHash, items, setInfo);
  if (piecesTier !== undefined) {
    entries = entries.filter((entry) => entry.pieces === piecesTier);
  }
  entries = entries.slice(0, maxIcons);
  const urls = armorSetIconUrls(setHash, items, setInfo, maxIcons, piecesTier);

  if (urls.length === 0) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 ${className}`}
        style={{ width: px, height: px }}
        aria-hidden
      >
        <SetIconFallback size={Math.round(px * 0.65)} />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-0.5 shrink-0 ${className}`}>
      {urls.map((url, index) => {
        const entry = entries[index];
        const title = entry?.name
          ? `${entry.pieces}pc · ${entry.name}`
          : entry
            ? `${entry.pieces}pc set bonus`
            : undefined;
        return (
          <span
            key={`${setHash}-${index}`}
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 overflow-hidden"
            style={{ width: px, height: px }}
            title={title}
          >
            <SetIconGlyph src={url} size={px} title={title} />
          </span>
        );
      })}
    </span>
  );
}

interface ComboTargetIconsProps {
  setBonus2pc?: number;
  setBonus4pc?: number;
  statIcons?: ReactNode;
  items?: ArmorPiece[];
  size?: ArmorSetIconSize;
  className?: string;
}

/** Combo tab icons: priority stats, then one set-bonus icon per configured target. */
export function ComboTargetIcons({
  setBonus2pc,
  setBonus4pc,
  statIcons,
  items = [],
  size = 'sm',
  className = '',
}: ComboTargetIconsProps) {
  const setTargets = parseSetBonusTargets(setBonus2pc, setBonus4pc);

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {statIcons}
      {setTargets.length > 0 && statIcons != null && (
        <span className="w-px h-3 bg-white/15 mx-0.5 shrink-0 self-center" aria-hidden />
      )}
      {setTargets.map((target) => (
        <ArmorSetIcons
          key={`${target.hash}-${target.pieces}`}
          setHash={target.hash}
          items={items}
          size={size}
          maxIcons={1}
          piecesTier={target.pieces}
        />
      ))}
    </span>
  );
}
