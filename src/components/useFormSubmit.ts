"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/lib/logbook/types";

type FormAction = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

const initial: ActionResult = { ok: true };

/**
 * Submits a form to a server action without React 19's automatic form reset,
 * so a failed save keeps everything the user typed (including a picked file).
 * `onSuccess` runs only after a successful save — reset the form or leave edit
 * mode there. `confirmMessage` asks before submitting (used for deletes).
 */
export function useFormSubmit(
  action: FormAction,
  { onSuccess, confirmMessage }: { onSuccess?: (form: HTMLFormElement) => void; confirmMessage?: string } = {},
) {
  const [state, setState] = useState<ActionResult>(initial);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      let res: ActionResult;
      try {
        res = await action(state, fd);
      } catch {
        res = { ok: false, error: "Couldn't save — check your connection and try again." };
      }
      setState(res);
      if (res.ok) onSuccess?.(form);
    });
  }

  return { state, pending, onSubmit };
}
