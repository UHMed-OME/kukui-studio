import { describe, it, expect } from "vitest";
import { isImportableLicense, licenseRejectionMessage } from "./license.js";
import type { SketchfabLicense } from "./client.js";

const lic = (slug: string, label: string = slug): SketchfabLicense => ({
  slug,
  label,
  url: `https://creativecommons.org/licenses/${slug}/4.0/`,
});

describe("isImportableLicense", () => {
  it("allows CC0", () => {
    expect(isImportableLicense(lic("cc0"))).toBe(true);
  });
  it("allows CC-BY", () => {
    expect(isImportableLicense(lic("by"))).toBe(true);
  });
  it("allows CC-BY-SA", () => {
    expect(isImportableLicense(lic("by-sa"))).toBe(true);
  });
  it("allows CC-BY-NC", () => {
    expect(isImportableLicense(lic("by-nc"))).toBe(true);
  });
  it("rejects CC-BY-ND", () => {
    expect(isImportableLicense(lic("by-nd"))).toBe(false);
  });
  it("rejects CC-BY-NC-ND", () => {
    expect(isImportableLicense(lic("by-nc-nd"))).toBe(false);
  });
  it("rejects proprietary / standard", () => {
    expect(isImportableLicense(lic("st", "Standard"))).toBe(false);
    expect(isImportableLicense(lic("ed", "Editorial"))).toBe(false);
  });
  it("rejects null license (unknown)", () => {
    expect(isImportableLicense(null)).toBe(false);
  });
});

describe("licenseRejectionMessage", () => {
  it("explains ND rejection", () => {
    const msg = licenseRejectionMessage(lic("by-nd"));
    expect(msg.toLowerCase()).toContain("derivative");
  });
  it("explains null/unknown", () => {
    expect(licenseRejectionMessage(null)).toMatch(/license/i);
  });
  it("explains proprietary", () => {
    expect(licenseRejectionMessage(lic("st", "Standard"))).toMatch(/proprietary|standard/i);
  });
});
