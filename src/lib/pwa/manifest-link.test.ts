import { describe, expect, it } from "vitest";
import { MANIFEST_HREF, manifestLinkProps } from "@/lib/pwa/manifest-link";

describe("manifestLinkProps", () => {
  it("sends the Access cookie with the manifest fetch", () => {
    // Without this the browser fetches the manifest credential-less and
    // Cloudflare Access redirects it to the login page -> not installable.
    expect(manifestLinkProps.crossOrigin).toBe("use-credentials");
  });

  it("points at the static manifest", () => {
    expect(manifestLinkProps).toEqual({
      rel: "manifest",
      href: MANIFEST_HREF,
      crossOrigin: "use-credentials",
    });
    expect(MANIFEST_HREF).toBe("/manifest.webmanifest");
  });
});
