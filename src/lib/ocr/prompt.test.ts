import { describe, it, expect } from "vitest";
import { buildReceiptPrompt } from "@/lib/ocr/prompt";

describe("buildReceiptPrompt", () => {
  it("asks for JSON and lists the category codes", () => {
    const p = buildReceiptPrompt();
    expect(p).toMatch(/JSON/i);
    expect(p).toContain("fuel");
    expect(p).toContain("insurance");
    // computed-only category must not be offered to the model
    expect(p).not.toContain("depreciation");
  });
});
