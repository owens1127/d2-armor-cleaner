import type { WantLabel } from '@/lib/scoring/learn';
import { WANT_LABEL_CLASS, WANT_LABEL_TEXT } from '@/lib/scoring/learn';

export function WantLabelBadge({ label }: { label: WantLabel }) {
  return (
    <span
      className={`inline-flex items-center shrink-0 text-[10px] font-medium uppercase tracking-wider leading-none px-1.5 py-0.5 rounded-md ${WANT_LABEL_CLASS[label]}`}
    >
      {WANT_LABEL_TEXT[label]}
    </span>
  );
}
