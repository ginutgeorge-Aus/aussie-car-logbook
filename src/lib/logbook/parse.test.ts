import { expect, test } from "vitest";
import { dollarsToCents, centsToDollars, parseVehicleForm, parseTripForm, parseLogbookPeriodForm } from "@/lib/logbook/parse";

function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.append(k, v);
  return f;
}

test("dollarsToCents rounds to nearest cent", () => {
  expect(dollarsToCents("12.50")).toBe(1250);
  expect(dollarsToCents("12")).toBe(1200);
  expect(dollarsToCents("12.505")).toBe(1251);
});

test("dollarsToCents rejects negative / non-numeric", () => {
  expect(() => dollarsToCents("-1")).toThrow(RangeError);
  expect(() => dollarsToCents("abc")).toThrow(RangeError);
});

test("dollarsToCents accepts only plain decimals", () => {
  for (const bad of ["1e3", "0x10", "0b1", "Infinity", "", " ", "1,000", "+5", "1.2.3", "12abc"]) {
    expect(() => dollarsToCents(bad), bad).toThrow(RangeError);
  }
  expect(dollarsToCents("0.1")).toBe(10);
  expect(dollarsToCents(".5")).toBe(50);
  expect(dollarsToCents("007.10")).toBe(710);
  expect(dollarsToCents("1.005")).toBe(101); // half-up on the 3rd decimal, no float error
});

test("centsToDollars formats", () => {
  expect(centsToDollars(1250)).toBe("12.50");
  expect(centsToDollars(0)).toBe("0.00");
});

test("parseVehicleForm ok with required fields", () => {
  const r = parseVehicleForm(fd({ make: "Toyota", model: "Corolla", rego: "ABC123", odoOpen: "50000" }));
  expect(r).toEqual({
    ok: true,
    value: { make: "Toyota", model: "Corolla", rego: "ABC123", odoOpen: 50000, purchaseDate: null, purchaseCostCents: null, purchaseGstCents: null },
  });
});

test("parseVehicleForm reads the GST on the purchase tax invoice (#46)", () => {
  const base = { make: "Toyota", model: "Corolla", purchaseDate: "2025-11-20", purchaseCost: "44000" };
  const r = parseVehicleForm(fd({ ...base, purchaseGst: "4000" }));
  expect(r.ok && r.value.purchaseGstCents).toBe(400000);
  // Private sale: GST is 0.
  const priv = parseVehicleForm(fd({ ...base, purchaseGst: "0" }));
  expect(priv.ok && priv.value.purchaseGstCents).toBe(0);
});

test("parseVehicleForm rejects purchase GST over 1/11 of the cost or without a cost", () => {
  const over = parseVehicleForm(fd({ make: "T", model: "C", purchaseCost: "44000", purchaseGst: "4000.01" }));
  expect(!over.ok && over.fieldErrors.purchaseGst).toMatch(/1\/11/);
  const noCost = parseVehicleForm(fd({ make: "T", model: "C", purchaseGst: "100" }));
  expect(!noCost.ok && noCost.fieldErrors.purchaseGst).toMatch(/purchase cost/);
});

test("parseVehicleForm errors when make/model missing", () => {
  const r = parseVehicleForm(fd({ make: "", model: "" }));
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.fieldErrors.make).toBeDefined();
    expect(r.fieldErrors.model).toBeDefined();
  }
});

test("parseTripForm ok computes nothing but validates odo order", () => {
  const r = parseTripForm(fd({ date: "2024-07-02", odoStart: "50000", odoEnd: "50040", purpose: "Client", isBusiness: "on" }));
  expect(r).toEqual({
    ok: true,
    value: { date: "2024-07-02", odoStart: 50000, odoEnd: 50040, purpose: "Client", isBusiness: true },
  });
});

test("parseTripForm errors when odoEnd <= odoStart", () => {
  const r = parseTripForm(fd({ date: "2024-07-02", odoStart: "50040", odoEnd: "50040", isBusiness: "" }));
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.fieldErrors.odoEnd).toBeDefined();
});

test("parseTripForm errors when date missing", () => {
  const r = parseTripForm(fd({ date: "", odoStart: "1", odoEnd: "2" }));
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.fieldErrors.date).toBeDefined();
});


test("parseLogbookPeriodForm accepts a 12-week period", () => {
  expect(parseLogbookPeriodForm(fd({ startDate: "2024-07-01", endDate: "2024-09-22" }))).toEqual({
    ok: true,
    value: { startDate: "2024-07-01", endDate: "2024-09-22", nominatedFy: null },
  });
});

test("parseLogbookPeriodForm keeps the nominated FY for a period crossing 30 June (#45)", () => {
  const r = parseLogbookPeriodForm(fd({ startDate: "2025-06-10", endDate: "2025-09-10", nominatedFy: "2025-26" }));
  expect(r).toEqual({ ok: true, value: { startDate: "2025-06-10", endDate: "2025-09-10", nominatedFy: "2025-26" } });
});

test("parseLogbookPeriodForm drops a nomination for a period inside one FY, rejects one outside the period", () => {
  const inside = parseLogbookPeriodForm(fd({ startDate: "2024-07-01", endDate: "2024-09-22", nominatedFy: "2024-25" }));
  expect(inside.ok && inside.value.nominatedFy).toBe(null);
  const outside = parseLogbookPeriodForm(fd({ startDate: "2025-06-10", endDate: "2025-09-10", nominatedFy: "2026-27" }));
  expect(!outside.ok && outside.fieldErrors.nominatedFy).toBeDefined();
});

test("parseLogbookPeriodForm rejects a period under 12 weeks", () => {
  const r = parseLogbookPeriodForm(fd({ startDate: "2024-07-01", endDate: "2024-09-21" }));
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.fieldErrors.endDate).toMatch(/12 continuous weeks/);
});

test("parseLogbookPeriodForm rejects missing, invalid and reversed dates", () => {
  const missing = parseLogbookPeriodForm(fd({ startDate: "", endDate: "" }));
  expect(missing.ok).toBe(false);
  if (!missing.ok) {
    expect(missing.fieldErrors.startDate).toBeDefined();
    expect(missing.fieldErrors.endDate).toBeDefined();
  }
  const invalid = parseLogbookPeriodForm(fd({ startDate: "2024-02-30", endDate: "2024-13-01" }));
  expect(invalid.ok).toBe(false);
  const reversed = parseLogbookPeriodForm(fd({ startDate: "2024-12-01", endDate: "2024-07-01" }));
  expect(reversed.ok).toBe(false);
  if (!reversed.ok) expect(reversed.fieldErrors.endDate).toMatch(/after/);
});
