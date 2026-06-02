import { Link } from 'react-router-dom';

export function PendingTagsFootnote({
  count,
  onClearAll,
}: {
  count: number;
  onClearAll: () => void;
}) {
  if (count <= 0) return null;

  function handleClear() {
    if (
      confirm(`Clear all ${count} pending tags? They will not be applied to DIM.`)
    ) {
      onClearAll();
    }
  }

  return (
    <p className="m-0 mt-5 pt-4 w-full border-t border-border/40 text-center text-[0.6875rem] leading-relaxed text-muted">
      <span>
        {count} tag{count === 1 ? '' : 's'} queued from earlier comparisons
      </span>
      <span className="text-muted/50"> · </span>
      <Link to="/review" className="text-white/75 hover:text-white hover:underline">
        Review tags
      </Link>
      <span className="text-muted/50"> · </span>
      <button
        type="button"
        onClick={handleClear}
        className="text-muted/80 hover:text-danger hover:underline underline-offset-2"
      >
        Clear all
      </button>
    </p>
  );
}
