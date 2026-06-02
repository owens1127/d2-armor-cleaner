/** Brief centered banner for in-page step/bucket/round transitions. */
export function TransitionFlash({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="transition-flash" role="status" aria-live="polite">
      {message}
    </div>
  );
}
