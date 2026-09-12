import { describe, expect, it } from "vitest";
import { parseExpenseForm } from "@/lib/expenses/parse";

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const base = { date: "2026-08-01", category: "fuel", amountIncl: "110.00" };

describe("parseExpenseForm", () => {
  it("parses a valid expense and defaults GST to amount/11", () => {
    const r = parseExpenseForm(fd(base));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual({
      date: "2026-08-01",
      category: "fuel",
      amountInclCents: 11000,
      gstCents: 1000, // round(11000/11)
      vendor: null,
      notes: null,
    });
  });

  it("uses an explicit GST when provided and clamps it to the amount", () => {
    expect((parseExpenseForm(fd({ ...base, gst: "5.00" })) as { value: { gstCents: number } }).value.gstCents).toBe(500);
    expect((parseExpenseForm(fd({ ...base, gst: "999.00" })) as { value: { gstCents: number } }).value.gstCents).toBe(11000);
  });

  it("zeroes GST when gstFree is checked, ignoring any typed GST", () => {
    const r = parseExpenseForm(fd({ ...base, gst: "9.00", gstFree: "on" }));
    expect((r as { value: { gstCents: number } }).value.gstCents).toBe(0);
  });

  it("trims vendor/notes and nulls them when blank", () => {
    const r = parseExpenseForm(fd({ ...base, vendor: "  BP  ", notes: "" }));
    expect((r as { value: { vendor: string | null; notes: string | null } }).value).toMatchObject({ vendor: "BP", notes: null });
  });

  it("rejects a missing date", () => {
    const r = parseExpenseForm(fd({ ...base, date: "" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors.date).toBeTruthy();
  });

  it("rejects an unknown category", () => {
    const r = parseExpenseForm(fd({ ...base, category: "boat" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors.category).toBeTruthy();
  });

  it("rejects a non-positive amount", () => {
    const r = parseExpenseForm(fd({ ...base, amountIncl: "0" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors.amountIncl).toBeTruthy();
  });

  it("rejects a negative GST", () => {
    const r = parseExpenseForm(fd({ ...base, gst: "-1" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors.gst).toBeTruthy();
  });
});
