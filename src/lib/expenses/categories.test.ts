import { expect, test } from "vitest";
import { categoryLabel } from "@/lib/expenses/categories";

test("categoryLabel maps codes to friendly labels", () => {
  expect(categoryLabel("rego")).toBe("Registration");
  expect(categoryLabel("service")).toBe("Servicing");
  expect(categoryLabel("depreciation")).toBe("Depreciation");
  expect(categoryLabel("mystery")).toBe("mystery");
});
