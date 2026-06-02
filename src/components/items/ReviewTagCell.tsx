import { ItemTagIndicator } from '@/components/items/ItemTagIndicator';
import {
  formatDimTagSummary,
  reviewTagPresentation,
} from '@/lib/dim/tagConfig';
import type { TagValue } from '@/types';

export interface ReviewTagCellProps {
  pendingTag: TagValue;
  dimTag?: TagValue | null;
  dimFavorite?: boolean;
  failed?: boolean;
}

export function ReviewTagCell({
  pendingTag,
  dimTag,
  dimFavorite = false,
  failed = false,
}: ReviewTagCellProps) {
  const dimSummary = formatDimTagSummary(dimTag, dimFavorite);
  const reviewTag = reviewTagPresentation(pendingTag);

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <ItemTagIndicator
          pendingTag={pendingTag}
          pendingColor={reviewTag.color}
          variant="inline"
          size="sm"
        />
        <span className="font-medium" style={{ color: reviewTag.color }}>
          {reviewTag.label}
        </span>
        {failed && <span className="text-danger text-xs">(failed)</span>}
      </div>
      {dimSummary && (
        <span className="text-xs text-muted">Already in DIM: {dimSummary}</span>
      )}
    </div>
  );
}
