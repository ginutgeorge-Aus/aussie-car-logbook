import { describe, expect, it, test } from "vitest";
import { dollarsToCents, centsToDollars, parseVehicleForm, parseTripForm, parseLogbookPeriodForm, parseLogbookPeriodOdometerForm, parseLogbookPeriodNominatedFyForm, parseVehicleFyOdometerForm } from "@/lib/logbook/parse";

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
    value: { make: "Toyota", model: "Corolla", rego: "ABC123", odoOpen: 50000, purchaseDate: null, purchaseCostCents: null, purchaseGstCents: null, effectiveLifeYears: null },
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
  const over = parseVehicleForm(fd({ make: "T", model: "C", purchaseCost: "44000", purchaseGst: "4001.01" }));
  expect(!over.ok && over.fieldErrors.purchaseGst).toMatch(/1\/11/);
  // Per-line GST rounding on a multi-line invoice can land a few cents over 1/11 of the total.
  const rounded = parseVehicleForm(fd({ make: "T", model: "C", purchaseCost: "44000", purchaseGst: "4000.03" }));
  expect(rounded.ok).toBe(true);
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
    value: { date: "2024-07-02", endDate: null, odoStart: 50000, odoEnd: 50040, purpose: "Client", isBusiness: true },
  });
});

test("parseTripForm requires a reason for a business trip (#50)", () => {
  const base = { date: "2024-07-02", odoStart: "50000", odoEnd: "50040", isBusiness: "on" };
  for (const purpose of [undefined, "", "   "]) {
    const r = parseTripForm(fd(purpose === undefined ? base : { ...base, purpose }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.purpose).toMatch(/reason/i);
  }
});

test("parseTripForm allows a private trip without a reason", () => {
  const r = parseTripForm(fd({ date: "2024-07-02", odoStart: "50000", odoEnd: "50040" }));
  expect(r).toEqual({ ok: true, value: { date: "2024-07-02", endDate: null, odoStart: 50000, odoEnd: 50040, purpose: null, isBusiness: false } });
});

test("parseTripForm end date: blank or same day -> null, later day kept, earlier/invalid rejected (#50)", () => {
  const base = { date: "2024-07-02", odoStart: "50000", odoEnd: "50040", purpose: "Interstate client" , isBusiness: "on" };
  const end = (endDate: string) => parseTripForm(fd({ ...base, endDate }));
  expect(end("")).toMatchObject({ ok: true, value: { endDate: null } });
  expect(end("2024-07-02")).toMatchObject({ ok: true, value: { endDate: null } });
  expect(end("2024-07-04")).toMatchObject({ ok: true, value: { endDate: "2024-07-04" } });
  for (const bad of ["2024-07-01", "2024-02-30", "soon"]) {
    const r = end(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.endDate).toBeDefined();
  }
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


const ODO = { odoStart: "50000", odoEnd: "50900" };

test("parseLogbookPeriodForm accepts a 12-week period", () => {
  expect(parseLogbookPeriodForm(fd({ startDate: "2024-07-01", endDate: "2024-09-22", ...ODO }))).toEqual({
    ok: true,
    value: { startDate: "2024-07-01", endDate: "2024-09-22", nominatedFy: null, odoStart: 50000, odoEnd: 50900 },
  });
});

test("parseLogbookPeriodForm keeps the nominated FY for a period crossing 30 June (#45)", () => {
  const r = parseLogbookPeriodForm(fd({ startDate: "2025-06-10", endDate: "2025-09-10", nominatedFy: "2025-26", ...ODO }));
  expect(r).toEqual({ ok: true, value: { startDate: "2025-06-10", endDate: "2025-09-10", nominatedFy: "2025-26", odoStart: 50000, odoEnd: 50900 } });
});

test("parseLogbookPeriodForm drops a nomination for a period inside one FY, rejects one outside the period", () => {
  const inside = parseLogbookPeriodForm(fd({ startDate: "2024-07-01", endDate: "2024-09-22", nominatedFy: "2024-25", ...ODO }));
  expect(inside.ok && inside.value.nominatedFy).toBe(null);
  const outside = parseLogbookPeriodForm(fd({ startDate: "2025-06-10", endDate: "2025-09-10", nominatedFy: "2026-27", ...ODO }));
  expect(!outside.ok && outside.fieldErrors.nominatedFy).toBeDefined();
});

test("parseLogbookPeriodForm rejects a period under 12 weeks", () => {
  const r = parseLogbookPeriodForm(fd({ startDate: "2024-07-01", endDate: "2024-09-21", ...ODO }));
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

test("parseLogbookPeriodForm requires odometers: missing, negative, fractional, end not above start (#49)", () => {
  const dates = { startDate: "2024-07-01", endDate: "2024-09-22" };
  const missing = parseLogbookPeriodForm(fd(dates));
  expect(missing.ok).toBe(false);
  if (!missing.ok) expect(Object.keys(missing.fieldErrors)).toEqual(["odoStart", "odoEnd"]);
  const bad = parseLogbookPeriodForm(fd({ ...dates, odoStart: "-1", odoEnd: "1.5" }));
  expect(bad.ok).toBe(false);
  if (!bad.ok) expect(Object.keys(bad.fieldErrors)).toEqual(["odoStart", "odoEnd"]);
  const equal = parseLogbookPeriodForm(fd({ ...dates, odoStart: "500", odoEnd: "500" }));
  expect(equal.ok).toBe(false);
  if (!equal.ok) expect(equal.fieldErrors.odoEnd).toMatch(/higher/);
});

test("parseLogbookPeriodOdometerForm accepts valid readings and rejects bad ones", () => {
  expect(parseLogbookPeriodOdometerForm(fd(ODO))).toEqual({ ok: true, value: { odoStart: 50000, odoEnd: 50900 } });
  const r = parseLogbookPeriodOdometerForm(fd({ odoStart: "900", odoEnd: "100" }));
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.fieldErrors.odoEnd).toMatch(/higher/);
  expect(parseLogbookPeriodOdometerForm(fd({})).ok).toBe(false);
});

describe("parseVehicleFyOdometerForm", () => {
  const form = fd;
  it("accepts a valid FY with both, one or no readings", () => {
    expect(parseVehicleFyOdometerForm(form({ fyLabel: "2025-26", odoOpen: "100", odoClose: "200" }))).toEqual({ ok: true, value: { fyLabel: "2025-26", odoOpen: 100, odoClose: 200 } });
    expect(parseVehicleFyOdometerForm(form({ fyLabel: "2025-26", odoOpen: "100", odoClose: "" }))).toEqual({ ok: true, value: { fyLabel: "2025-26", odoOpen: 100, odoClose: null } });
    expect(parseVehicleFyOdometerForm(form({ fyLabel: "2099-00" }))).toEqual({ ok: true, value: { fyLabel: "2099-00", odoOpen: null, odoClose: null } });
    expect(parseVehicleFyOdometerForm(form({ fyLabel: "2025-26", odoOpen: "100", odoClose: "100" })).ok).toBe(true);
  });
  it.each(["", "2025", "2025-27", "2025-2026", "25-26", "2026-25"])("rejects FY label %j", (fyLabel) => {
    const r = parseVehicleFyOdometerForm(form({ fyLabel }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.fyLabel).toBeDefined();
  });
  it("rejects negative, fractional and non-numeric readings", () => {
    for (const bad of ["-1", "1.5", "abc"]) {
      const r = parseVehicleFyOdometerForm(form({ fyLabel: "2025-26", odoOpen: bad, odoClose: bad }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(Object.keys(r.fieldErrors).sort()).toEqual(["odoClose", "odoOpen"]);
    }
  });
  it("rejects close below open", () => {
    const r = parseVehicleFyOdometerForm(form({ fyLabel: "2025-26", odoOpen: "200", odoClose: "100" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.odoClose).toMatch(/below/);
  });
});

test("parseVehicleForm reads an optional whole-year effective life (#66)", () => {
  const base = { make: "T", model: "C" };
  const r = parseVehicleForm(fd({ ...base, effectiveLifeYears: "4" }));
  expect(r.ok && r.value.effectiveLifeYears).toBe(4);
  const blank = parseVehicleForm(fd({ ...base, effectiveLifeYears: "" }));
  expect(blank.ok && blank.value.effectiveLifeYears).toBeNull();
  for (const bad of ["0", "51", "2.5", "abc", "-3"]) {
    const e = parseVehicleForm(fd({ ...base, effectiveLifeYears: bad }));
    expect(!e.ok && e.fieldErrors.effectiveLifeYears).toMatch(/1 to 50/);
  }
});

describe("parseLogbookPeriodNominatedFyForm", () => {
  const crossing = ["2025-06-10", "2025-09-10"] as const;
  test("accepts the start FY", () => {
    expect(parseLogbookPeriodNominatedFyForm(fd({ nominatedFy: "2024-25" }), ...crossing)).toEqual({ ok: true, value: { nominatedFy: "2024-25" } });
  });
  test("accepts the end FY", () => {
    expect(parseLogbookPeriodNominatedFyForm(fd({ nominatedFy: "2025-26" }), ...crossing)).toEqual({ ok: true, value: { nominatedFy: "2025-26" } });
  });
  test("rejects a label that is neither FY, or a missing one", () => {
    const bad = parseLogbookPeriodNominatedFyForm(fd({ nominatedFy: "2026-27" }), ...crossing);
    expect(!bad.ok && bad.fieldErrors.nominatedFy).toBeDefined();
    const none = parseLogbookPeriodNominatedFyForm(fd({}), ...crossing);
    expect(!none.ok && none.fieldErrors.nominatedFy).toBeDefined();
  });
  test("rejects a period that does not cross 30 June", () => {
    const r = parseLogbookPeriodNominatedFyForm(fd({ nominatedFy: "2024-25" }), "2024-07-01", "2024-09-22");
    expect(!r.ok && r.fieldErrors.nominatedFy).toBeDefined();
  });
});
