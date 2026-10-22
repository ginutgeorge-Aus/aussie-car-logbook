// Each rule tested here maps to its ATO source in docs/ato-rules.md.
import { describe, expect, it } from "vitest";
import { isValidAbn, normaliseAbn } from "@/lib/tax/abn";

describe("ABN", () => {
  it("normalises spaces away", () => {
    expect(normaliseAbn(" 51 824 753 556 ")).toBe("51824753556");
  });
  it("accepts a valid ABN (ATO's own: 51 824 753 556), with or without spaces", () => {
    expect(isValidAbn("51824753556")).toBe(true);
    expect(isValidAbn("51 824 753 556")).toBe(true);
  });
  it("rejects a wrong checksum", () => {
    expect(isValidAbn("51824753557")).toBe(false);
  });
  it("rejects wrong length or non-digits", () => {
    expect(isValidAbn("5182475355")).toBe(false);
    expect(isValidAbn("518247535561")).toBe(false);
    expect(isValidAbn("5182475355a")).toBe(false);
    expect(isValidAbn("")).toBe(false);
  });
});
