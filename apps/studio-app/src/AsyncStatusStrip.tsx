/**
 * Sticky status strip beside the validation badge. Renders nothing when
 * `status` is null. Visible until either auto-cleared (success kind, by
 * the parent) or dismissed (error/build kinds, by clicking the X).
 *
 * `role="status"` + `aria-live="polite"` so screen readers announce
 * state transitions without interrupting the current focus.
 */

export type AsyncStatus = {
  kind: "building" | "importing" | "error" | "success";
  message: string;
  dismissable: boolean;
};

export function AsyncStatusStrip({
  status,
  onDismiss,
}: {
  status: AsyncStatus | null;
  onDismiss: () => void;
}) {
  if (!status) return null;
  const inProgress = status.kind === "building" || status.kind === "importing";
  return (
    <div
      className={`kukui-studio-async kukui-studio-async--${status.kind}`}
      role="status"
      aria-live="polite"
    >
      {inProgress ? (
        <span
          className="kukui-studio-async__spinner"
          aria-hidden="true"
        />
      ) : (
        <span
          className="kukui-studio-async__dot"
          aria-hidden="true"
        />
      )}
      <span className="kukui-studio-async__msg">{status.message}</span>
      {status.dismissable ? (
        <button
          type="button"
          className="kukui-studio-async__close"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
