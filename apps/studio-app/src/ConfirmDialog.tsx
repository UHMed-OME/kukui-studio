import { useEffect, useRef } from "react";

/**
 * Modal confirm dialog — replaces native window.confirm() with a styled
 * surface that matches the app's glass theme. Escape cancels, click-outside
 * cancels, the confirm button takes focus on open.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
        return;
      }
      // Focus trap: cycle Tab/Shift+Tab between Cancel and Confirm so AT
      // users can't escape into the disabled background.
      if (e.key === "Tab") {
        const cancel = cancelRef.current;
        const confirm = confirmRef.current;
        if (!cancel || !confirm) return;
        if (e.shiftKey && document.activeElement === cancel) {
          e.preventDefault();
          confirm.focus();
        } else if (!e.shiftKey && document.activeElement === confirm) {
          e.preventDefault();
          cancel.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    confirmRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      // Restore focus to whatever opened the dialog so keyboard users
      // don't lose their place in the page after the modal closes.
      previousFocus?.focus?.();
    };
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="ks-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ks-dialog-title"
      aria-describedby="ks-dialog-message"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="ks-dialog">
        <h2 id="ks-dialog-title" className="ks-dialog__title">
          {title}
        </h2>
        <p id="ks-dialog-message" className="ks-dialog__message">
          {message}
        </p>
        <div className="ks-dialog__actions">
          <button
            ref={cancelRef}
            type="button"
            className="kukui-studio-btn kukui-studio-btn--ghost"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={[
              "kukui-studio-btn",
              destructive ? "kukui-studio-btn--danger" : "kukui-studio-btn--primary",
            ].join(" ")}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
