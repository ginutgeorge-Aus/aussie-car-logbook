import { describe, expect, it } from "vitest";
import { OcrLicenceError, buildOcrMessages, extractOcrResponse, toOcrError } from "./model";

describe("buildOcrMessages", () => {
  it("sends the image as a base64 data URI content part, not a byte array", () => {
    const msgs = buildOcrMessages("read it", "image/jpeg", new Uint8Array([0xff, 0xd8, 0xff]));
    expect(msgs[1].content).toEqual([
      { type: "text", text: "read it" },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,/9j/" } },
    ]);
  });
});

describe("toOcrError", () => {
  it("maps the licence-not-accepted error (5016) to OcrLicenceError", () => {
    const e = new Error("5016: Prior to using this model, you must submit the prompt 'agree'");
    expect(toOcrError(e)).toBeInstanceOf(OcrLicenceError);
  });

  it("passes other errors through unchanged", () => {
    const e = new Error("network down");
    expect(toOcrError(e)).toBe(e);
  });
});

describe("extractOcrResponse", () => {
  it("returns response text", () => {
    expect(extractOcrResponse({ response: '{"total":"1.00"}' })).toBe('{"total":"1.00"}');
  });

  it("returns an already-parsed response object", () => {
    expect(extractOcrResponse({ response: { total: "1.00" } })).toEqual({ total: "1.00" });
  });

  it.each([{ response: "  " }, {}, null, { response: 42 }])("throws on unusable output %j", (res) => {
    expect(() => extractOcrResponse(res)).toThrow(/unexpected model output/);
  });
});
