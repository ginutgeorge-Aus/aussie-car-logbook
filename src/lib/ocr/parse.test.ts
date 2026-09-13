import { describe, it, expect } from "vitest";
import { parseOcrResult } from "@/lib/ocr/parse";

const ALL_NULL = {
  dateISO: null, amountInclCents: null, gstCents: null, vendor: null, category: null,
};

describe("parseOcrResult", () => {
  it("parses a clean object", () => {
    const r = parseOcrResult({
      date: "14/03/2026", total: "82.50", gst: "7.50", vendor: "Shell", category: "fuel",
    });
    expect(r).toEqual({
      dateISO: "2026-03-14", amountInclCents: 8250, gstCents: 750, vendor: "Shell", category: "fuel",
    });
  });

  it("parses JSON wrapped in a code fence + prose", () => {
    const raw = 'Here you go:\n```json\n{"date":"2026-03-14","total":"$1,234.50","gst":"","vendor":"Repco","category":"Repairs"}\n```';
    const r = parseOcrResult(raw);
    expect(r.dateISO).toBe("2026-03-14");
    expect(r.amountInclCents).toBe(123450);
    expect(r.gstCents).toBeNull();
    expect(r.vendor).toBe("Repco");
    expect(r.category).toBe("repairs"); // normalized lowercase
  });

  it("reads Australian day-first dates and 2-digit years", () => {
    expect(parseOcrResult({ date: "3/7/26" }).dateISO).toBe("2026-07-03");
    expect(parseOcrResult({ date: "14-03-2026" }).dateISO).toBe("2026-03-14");
    expect(parseOcrResult({ date: "14 Mar 2026" }).dateISO).toBe("2026-03-14");
  });

  it("rejects unparseable / impossible dates without guessing", () => {
    expect(parseOcrResult({ date: "last tuesday" }).dateISO).toBeNull();
    expect(parseOcrResult({ date: "45/13/2026" }).dateISO).toBeNull();
    expect(parseOcrResult({ date: "" }).dateISO).toBeNull();
  });

  it("cleans currency to cents; rejects junk", () => {
    expect(parseOcrResult({ total: "$1,234.50" }).amountInclCents).toBe(123450);
    expect(parseOcrResult({ total: "1234.5" }).amountInclCents).toBe(123450);
    expect(parseOcrResult({ total: 82.5 }).amountInclCents).toBe(8250);
    expect(parseOcrResult({ total: "n/a" }).amountInclCents).toBeNull();
    expect(parseOcrResult({ total: "-5.00" }).amountInclCents).toBeNull();
  });

  it("clamps GST over total and drops negatives; null GST stays null", () => {
    expect(parseOcrResult({ total: "10.00", gst: "50.00" }).gstCents).toBe(1000);
    expect(parseOcrResult({ gst: "-1.00" }).gstCents).toBeNull();
    expect(parseOcrResult({ total: "10.00" }).gstCents).toBeNull();
  });

  it("normalizes / rejects categories; never returns depreciation", () => {
    expect(parseOcrResult({ category: "FUEL" }).category).toBe("fuel");
    expect(parseOcrResult({ category: "groceries" }).category).toBeNull();
    expect(parseOcrResult({ category: "depreciation" }).category).toBeNull();
  });

  it("cleans vendor; drops empty / 'null' / overlong", () => {
    expect(parseOcrResult({ vendor: "  BP  " }).vendor).toBe("BP");
    expect(parseOcrResult({ vendor: "null" }).vendor).toBeNull();
    expect(parseOcrResult({ vendor: "x".repeat(200) }).vendor).toBeNull();
  });

  it("returns all-null for junk input, never throws", () => {
    expect(parseOcrResult("not json at all")).toEqual(ALL_NULL);
    expect(parseOcrResult("")).toEqual(ALL_NULL);
    expect(parseOcrResult(null)).toEqual(ALL_NULL);
    expect(parseOcrResult([1, 2, 3])).toEqual(ALL_NULL);
    expect(parseOcrResult({ unrelated: "key" })).toEqual(ALL_NULL);
  });

  it("rejects calendar-invalid days (month- and leap-aware)", () => {
    expect(parseOcrResult({ date: "31/04/2026" }).dateISO).toBeNull();
    expect(parseOcrResult({ date: "30/02/2026" }).dateISO).toBeNull();
    expect(parseOcrResult({ date: "29/02/2025" }).dateISO).toBeNull();
    expect(parseOcrResult({ date: "29/02/2024" }).dateISO).toBe("2024-02-29");
    expect(parseOcrResult({ date: "2026-04-31" }).dateISO).toBeNull();
  });
});
