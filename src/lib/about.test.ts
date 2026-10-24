import { describe, expect, it } from "vitest";
import { changelogUrl, formatUpdated, issueUrl, REPO_URL } from "@/lib/about";

describe("about", () => {
  it("changelogUrl points at upstream releases", () => {
    expect(changelogUrl()).toBe(`${REPO_URL}/releases`);
    expect(changelogUrl()).toBe("https://github.com/ginutgeorge-Aus/aussie-car-logbook/releases");
  });

  it("issueUrl pre-fills the bug form version", () => {
    expect(issueUrl("0.4.0")).toBe(
      "https://github.com/ginutgeorge-Aus/aussie-car-logbook/issues/new?template=bug_report.yml&version=v0.4.0",
    );
  });

  it("issueUrl encodes odd input", () => {
    expect(issueUrl("1.0 &x=y#z")).toBe(`${REPO_URL}/issues/new?template=bug_report.yml&version=v1.0%20%26x%3Dy%23z`);
  });

  it("formatUpdated renders en-AU date in Sydney", () => {
    expect(formatUpdated("2026-10-24T03:00:00Z")).toBe("24 Oct 2026");
  });

  it("formatUpdated uses the Sydney calendar day, not UTC", () => {
    expect(formatUpdated("2026-10-24T14:00:00Z")).toBe("25 Oct 2026");
  });

  it("formatUpdated falls back to unknown", () => {
    expect(formatUpdated(undefined)).toBe("unknown");
    expect(formatUpdated("garbage")).toBe("unknown");
  });
});
