import { expect, test } from "vitest";
import { tripKm, tripsToLegs, filterTripsByFy, fyBusinessPct } from "@/lib/logbook/compute";

test("tripKm is odoEnd - odoStart", () => {
  expect(tripKm({ odoStart: 50000, odoEnd: 50040 })).toBe(40);
});

test("tripsToLegs maps to {km,isBusiness}", () => {
  expect(
    tripsToLegs([
      { odoStart: 0, odoEnd: 40, isBusiness: true },
      { odoStart: 40, odoEnd: 60, isBusiness: false },
    ]),
  ).toEqual([
    { km: 40, isBusiness: true },
    { km: 20, isBusiness: false },
  ]);
});

test("filterTripsByFy keeps only trips in the FY", () => {
  const trips = [
    { date: "2024-07-02" }, // FY 2024-25
    { date: "2024-06-30" }, // FY 2023-24
    { date: "2025-06-30" }, // FY 2024-25
  ];
  expect(filterTripsByFy(trips, "2024-25")).toEqual([
    { date: "2024-07-02" },
    { date: "2025-06-30" },
  ]);
});

test("fyBusinessPct = rounded business% over FY trips", () => {
  const trips = [
    { date: "2024-07-02", odoStart: 0, odoEnd: 40, isBusiness: true },
    { date: "2024-07-03", odoStart: 40, odoEnd: 60, isBusiness: false },
    { date: "2023-07-03", odoStart: 0, odoEnd: 999, isBusiness: false }, // other FY, excluded
  ];
  expect(fyBusinessPct(trips, "2024-25")).toBe(67); // 40/60
});

test("fyBusinessPct with no FY trips is 0 (no divide-by-zero)", () => {
  expect(fyBusinessPct([], "2024-25")).toBe(0);
});
