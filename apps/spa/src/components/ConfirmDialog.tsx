/**
 * In-app confirm dialog — replaces `window.confirm`, which some browsers and
 * embedded webviews suppress entirely (making destructive buttons appear to
 * "do nothing"), and which can't be styled or tested.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
  pending,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  pending?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center p-4 z-50">
      <div className="card w-full max-w-sm p-6">
        <h2 className="font-bold text-lg">{title}</h2>
        <p className="text-sm text-neutral-500 mt-2">{body}</p>
        <div className="flex gap-2 justify-end mt-5">
          <button className="btn btn-outline" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={pending}>
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
