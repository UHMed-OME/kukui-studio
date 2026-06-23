import { describe, it, expect } from "vitest";
import {
  parseGoogleSlidesId,
  googleSlidesEmbedUrl,
  importGoogleSlides,
  GoogleSlidesUnavailableError,
} from "./importGoogleSlides.js";

describe("parseGoogleSlidesId", () => {
  it("extracts the id from an edit URL", () => {
    expect(
      parseGoogleSlidesId("https://docs.google.com/presentation/d/ABC123_xy/edit#slide=id.p1"),
    ).toBe("ABC123_xy");
  });

  it("extracts the id from a published /d/e/ URL", () => {
    expect(
      parseGoogleSlidesId("https://docs.google.com/presentation/d/e/PUB-456/pub?start=false"),
    ).toBe("PUB-456");
  });

  it("returns null for non-Slides URLs", () => {
    expect(parseGoogleSlidesId("https://example.com/x")).toBeNull();
    expect(parseGoogleSlidesId("https://docs.google.com/document/d/abc/edit")).toBeNull();
    expect(parseGoogleSlidesId("not a url")).toBeNull();
  });
});

describe("googleSlidesEmbedUrl", () => {
  it("builds an embed URL from a deck id", () => {
    expect(googleSlidesEmbedUrl("XYZ")).toBe(
      "https://docs.google.com/presentation/d/XYZ/embed",
    );
  });
});

describe("importGoogleSlides", () => {
  it("rejects with guidance for a valid Slides link (CORS fallback to PDF)", async () => {
    await expect(
      importGoogleSlides("https://docs.google.com/presentation/d/ABC/edit"),
    ).rejects.toBeInstanceOf(GoogleSlidesUnavailableError);
    await expect(
      importGoogleSlides("https://docs.google.com/presentation/d/ABC/edit"),
    ).rejects.toThrow(/PDF/i);
  });

  it("rejects with guidance for a non-Slides link", async () => {
    await expect(importGoogleSlides("https://example.com/x")).rejects.toBeInstanceOf(
      GoogleSlidesUnavailableError,
    );
  });
});
