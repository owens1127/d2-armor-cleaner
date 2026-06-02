import { Layout } from '@/components/Layout';
import { BUCKET_ELIMINATION_LOSS_THRESHOLD } from '@/lib/constants';
import { DuelKeyboardLegend } from '@/components/duel/DuelKeyboardLegend';

export function DuelKeyboardHints() {
  return (
    <>
      <div className="hidden sm:flex flex-col items-center gap-1.5 w-full">
        <DuelKeyboardLegend />
        <p className="m-0 text-center text-[0.625rem] text-muted">
          Touch: swipe to prefer. Loser needs {BUCKET_ELIMINATION_LOSS_THRESHOLD} losses before junk · Undo U · Skip S
        </p>
      </div>
      <p className="m-0 text-[0.625rem] text-muted sm:hidden">
        Swipe to prefer. {BUCKET_ELIMINATION_LOSS_THRESHOLD} losses to junk.
      </p>
    </>
  );
}

export function DuelPageCenter({ children }: { children: React.ReactNode }) {
  return (
    <Layout>
      <div className="clean-page">
        <div className="clean-page__stage">
          <div className="clean-page__center text-center">{children}</div>
        </div>
      </div>
    </Layout>
  );
}
