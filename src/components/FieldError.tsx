/** Inline validation message for one field, announced to screen readers. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-sm text-danger">
      {message}
    </p>
  );
}

/** Form-level error banner (server/action errors), announced to screen readers. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="w-full rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}
