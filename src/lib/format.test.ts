import { expect, test } from "vitest";
import { humanDate, formatMoney, formatMoneyWhole, formatKm, odometerDigits, fyShort } from "@/lib/format";

test("humanDate formats ISO as weekday day month, no timezone drift", () => {
  expect(humanDate("2026-09-14")).toBe("Mon 14 Sep");
  expect(humanDate("2026-07-01")).toBe("Wed 1 Jul");
  expect(humanDate("2027-06-30")).toBe("Wed 30 Jun");
});

test("humanDate can append the year", () => {
  expect(humanDate("2026-09-14", { withYear: true })).toBe("Mon 14 Sep 2026");
});

test("humanDate returns malformed input unchanged", () => {
  expect(humanDate("not-a-date")).toBe("not-a-date");
});

test("formatMoney renders cents as dollars with separators", () => {
  expect(formatMoney(481240)).toBe("$4,812.40");
  expect(formatMoney(5)).toBe("$0.05");
  expect(formatMoney(0)).toBe("$0.00");
  expect(formatMoney(123456789)).toBe("$1,234,567.89");
  expect(formatMoney(-2550)).toBe("-$25.50");
});

test("formatMoneyWhole rounds to whole dollars", () => {
  expect(formatMoneyWhole(481240)).toBe("$4,812");
  expect(formatMoneyWhole(481250)).toBe("$4,813");
  expect(formatMoneyWhole(0)).toBe("$0");
});

test("formatKm adds thousands separators", () => {
  expect(formatKm(84312)).toBe("84,312");
  expect(formatKm(9)).toBe("9");
});

test("odometerDigits pads to six digits", () => {
  expect(odometerDigits(84312)).toEqual(["0", "8", "4", "3", "1", "2"]);
  expect(odometerDigits(1234567)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
  expect(odometerDigits(0)).toEqual(["0", "0", "0", "0", "0", "0"]);
});

test("fyShort turns 2026-27 into 26–27", () => {
  expect(fyShort("2026-27")).toBe("26–27");
  expect(fyShort("odd")).toBe("odd");
});
