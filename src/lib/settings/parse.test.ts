import { describe, expect, it } from "vitest";
import { formatAbn, isValidAbn, parseSettingsForm } from "@/lib/settings/parse";

/** Builds a FormData from plain string fields. */
function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("isValidAbn", () => {
  it("accepts the ATO's documented example ABN 51 824 753 556", () => {
    expect(isValidAbn("51824753556")).toBe(true);
  });

  it("rejects a bad checksum, wrong length and non-digits", () => {
    expect(isValidAbn("51824753557")).toBe(false);
    expect(isValidAbn("00000000000")).toBe(false); // the seed placeholder
    expect(isValidAbn("5182475355")).toBe(false);
    expect(isValidAbn("5182475355a")).toBe(false);
  });
});

describe("formatAbn", () => {
  it("rejects a leading zero even when the checksum passes", () => {
    expect(isValidAbn("01300000000")).toBe(false);
  });

  it("groups digits as XX XXX XXX XXX", () => {
    expect(formatAbn("51824753556")).toBe("51 824 753 556");
  });
});

describe("parseSettingsForm", () => {
  it("normalises a valid ABN typed with spaces and reads the checkbox as on", () => {
    expect(parseSettingsForm(fd({ gstRegistered: "on", abn: " 51 8247 53556 " }))).toEqual({
      ok: true,
      value: { gstRegistered: true, abn: "51 824 753 556" },
    });
  });

  it("treats a missing checkbox as not GST-registered", () => {
    const r = parseSettingsForm(fd({ abn: "51824753556" }));
    expect(r.ok && r.value.gstRegistered).toBe(false);
  });

  it("clears the ABN to null when empty", () => {
    expect(parseSettingsForm(fd({ gstRegistered: "on", abn: "   " }))).toEqual({
      ok: true,
      value: { gstRegistered: true, abn: null },
    });
    expect(parseSettingsForm(fd({}))).toEqual({ ok: true, value: { gstRegistered: false, abn: null } });
  });

  it("rejects an ABN with an invalid checksum", () => {
    expect(parseSettingsForm(fd({ abn: "51 824 753 557" }))).toEqual({
      ok: false,
      fieldErrors: { abn: "That ABN isn't valid — check the digits." },
    });
  });

  it("rejects an ABN of the wrong length or with letters", () => {
    expect(parseSettingsForm(fd({ abn: "1234" }))).toEqual({ ok: false, fieldErrors: { abn: "ABN must be 11 digits." } });
    expect(parseSettingsForm(fd({ abn: "51-824-753-556" }))).toEqual({
      ok: false,
      fieldErrors: { abn: "ABN must be 11 digits." },
    });
  });
});
