import { CopyDimQueryButton } from '@/components/items/CopyDimQueryButton';
import { TagActionButton } from '@/components/items/TagActionButton';
import {
  LOADOUT_ACTION_CELL_CLASS,
  LOADOUT_ACTION_GRID_CLASS,
  browseCardActionRailStyle,
} from '@/components/dashboard/buildCoverageLayout';
import {
  tagActionFavoriteActive,
  tagActionJunkActive,
  tagActionKeepActive,
} from '@/lib/dim/tagConfig';
import type { ArmorPiece } from '@/types';

export interface BrowseCardActionGridProps {
  piece: ArmorPiece;
  onToggleKeep: (piece: ArmorPiece) => void;
  onToggleFavorite: (piece: ArmorPiece) => void;
  onToggleJunk: (piece: ArmorPiece) => void;
}

export function BrowseCardActionGrid({
  piece,
  onToggleKeep,
  onToggleFavorite,
  onToggleJunk,
}: BrowseCardActionGridProps) {
  const isTaggedKeep = tagActionKeepActive(piece);
  const isTaggedJunk = tagActionJunkActive(piece);
  const dimFavorite = tagActionFavoriteActive(piece);

  return (
    <div
      className={LOADOUT_ACTION_GRID_CLASS}
      style={browseCardActionRailStyle()}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className={LOADOUT_ACTION_CELL_CLASS}>
        <CopyDimQueryButton compact instanceId={piece.instanceId} itemName={piece.name} />
      </div>
      <div className={LOADOUT_ACTION_CELL_CLASS}>
        <TagActionButton
          compact
          tag="keep"
          active={isTaggedKeep}
          title={isTaggedKeep ? 'Remove keep tag in DIM' : 'Tag keep in DIM'}
          onClick={() => onToggleKeep(piece)}
        />
      </div>
      <div className={LOADOUT_ACTION_CELL_CLASS}>
        <TagActionButton
          compact
          tag="favorite"
          active={dimFavorite}
          locked={dimFavorite}
          title={dimFavorite ? 'Already favorited in DIM' : 'Tag favorite in DIM'}
          onClick={() => onToggleFavorite(piece)}
        />
      </div>
      <div className={LOADOUT_ACTION_CELL_CLASS}>
        <TagActionButton
          compact
          tag="junk"
          active={isTaggedJunk}
          title={isTaggedJunk ? 'Remove junk tag in DIM' : 'Tag junk in DIM'}
          onClick={() => onToggleJunk(piece)}
        />
      </div>
    </div>
  );
}
