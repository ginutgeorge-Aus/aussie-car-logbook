import { useId } from "react";

/** Inline validation message for one field, announced to screen readers. */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-danger">
      {message}
    </p>
  );
}

/**
 * Links each field to its error: `f(name).input` spreads `aria-invalid` +
 * `aria-describedby` onto the control (only while it has an error), and
 * `f(name).error` spreads the matching `id` + `message` onto `FieldError`.
 * `useId` keeps ids unique when the same form renders more than once (row edits).
 */
export function useFieldErrors(errs: Partial<Record<string, string>>) {
  const uid = useId();
  return (name: string) => {
    const id = `${uid}-${name}-error`;
    const message = errs[name];
    return {
      input: message ? { "aria-invalid": true as const, "aria-describedby": id } : {},
      error: { id, message },
    };
  };
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
