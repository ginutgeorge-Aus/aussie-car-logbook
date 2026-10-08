import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const pub = (p: string) => path.join(process.cwd(), "public", p.replace(/^\//, ""));
const manifest = JSON.parse(readFileSync(pub("manifest.webmanifest"), "utf8"));

/** Width/height from a PNG's IHDR chunk (bytes 16-23, big-endian). */
function pngSize(file: string): [number, number] {
  const b = readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe("manifest.webmanifest", () => {
  it("has a stable id inside scope", () => {
    expect(manifest.id).toBe("/");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  it("every icon exists and its PNG size matches `sizes`", () => {
    for (const icon of manifest.icons) {
      const file = pub(icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      const [w, h] = pngSize(file);
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
  });

  it("ships any + maskable icons at 192 and 512", () => {
    for (const purpose of ["any", "maskable"]) {
      const sizes = manifest.icons
        .filter((i: { purpose: string }) => i.purpose === purpose)
        .map((i: { sizes: string }) => i.sizes);
      expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    }
  });
});

describe("template leftovers", () => {
  it.each(["file.svg", "globe.svg", "next.svg", "vercel.svg", "window.svg"])(
    "public/%s removed",
    (f) => {
      expect(existsSync(pub(f))).toBe(false);
    },
  );
  it("create-next-app favicon removed", () => {
    expect(existsSync(path.join(process.cwd(), "src/app/favicon.ico"))).toBe(false);
  });
});
