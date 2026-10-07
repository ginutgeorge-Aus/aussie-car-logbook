"use client";

import { saveSettingsAction } from "@/lib/actions";
import { FieldError } from "@/components/FieldError";
import { useFormSubmit } from "@/components/useFormSubmit";

/** Edits the GST-registered flag and ABN; FY start is shown read-only (July–June is fixed). */
export function SettingsForm({ settings }: { settings: { gstRegistered: boolean; abn: string | null } }) {
  const { state, pending, onSubmit } = useFormSubmit(saveSettingsAction);
  const errs = state.ok ? {} : (state.fieldErrors ?? {});

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4 max-w-md">
      <label className="flex items-start gap-2">
        <input name="gstRegistered" type="checkbox" defaultChecked={settings.gstRegistered} className="mt-1" />
        <span>
          <span className="block">Registered for GST</span>
          <span className="block text-sm text-zinc-600">
            On: you claim GST credits on your BAS and deductions use GST-exclusive amounts. Off: no BAS credits; deductions use the full amount.
          </span>
        </span>
      </label>
      <label className="flex flex-col gap-1">
        <span>ABN (optional)</span>
        <input
          name="abn"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="51 824 753 556"
          defaultValue={settings.abn ?? ""}
          className="border rounded px-2 py-1"
        />
        <FieldError message={errs.abn} />
      </label>
      <div className="flex flex-col gap-1">
        <span>Financial year starts</span>
        <p className="text-zinc-600">July (Australian financial year)</p>
      </div>
      <button type="submit" disabled={pending} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
        {pending ? "Saving…" : "Save settings"}
      </button>
      {state.ok && state.saved && !pending ? <p className="text-sm text-green-600">Saved.</p> : null}
      {!state.ok && state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
