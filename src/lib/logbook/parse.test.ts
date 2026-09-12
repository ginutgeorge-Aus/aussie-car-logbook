import { expect, test } from "vitest";
import { dollarsToCents, centsToDollars, parseVehicleForm, parseTripForm } from "@/lib/logbook/parse";

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
