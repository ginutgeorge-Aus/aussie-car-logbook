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

test("centsToDollars formats", () => {
  expect(centsToDollars(1250)).toBe("12.50");
  expect(centsToDollars(0)).toBe("0.00");
});

test("parseVehicleForm ok with required fields", () => {
  const r = parseVehicleForm(fd({ make: "Toyota", model: "Corolla", rego: "ABC123", odoOpen: "50000" }));
  expect(r).toEqual({
    ok: true,
    value: { make: "Toyota", model: "Corolla", rego: "ABC123", odoOpen: 50000, purchaseDate: null, purchaseCostCents: null },
  });
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
    value: { startDate: "2024-07-01", endDate: "2024-09-22" },
  });
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
