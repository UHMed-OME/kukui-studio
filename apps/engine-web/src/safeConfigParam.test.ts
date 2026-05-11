import { describe, expect, it } from "vitest";
import { safeConfigParam } from "./safeConfigParam.js";

describe("safeConfigParam", () => {
  it("returns null for empty / null input", () => {
    expect(safeConfigParam(null)).toBeNull();
    expect(safeConfigParam("")).toBeNull();
  });

  it("rejects javascript: scheme", () => {
    expect(safeConfigParam("javascript:alert(1)")).toBeNull();
  });

  it("rejects data: URLs", () => {
    expect(safeConfigParam("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeConfigParam("//evil.com/x.json")).toBeNull();
  });

  it("accepts root-relative same-origin paths", () => {
    expect(safeConfigParam("/samples/foo/basic.json")).toBe("/samples/foo/basic.json");
  });

  it("rejects /../etc/passwd traversal (root-relative `..`)", () => {
    expect(safeConfigParam("/../etc/passwd")).toBeNull();
  });

  it("rejects relative traversal", () => {
    expect(safeConfigParam("./samples/x/../../bad.json")).toBeNull();
  });

  it("accepts plain relative paths", () => {
    expect(safeConfigParam("samples/foo/basic.json")).toBe("samples/foo/basic.json");
  });

  it("rejects http: scheme", () => {
    expect(safeConfigParam("http://evil.com/x.json")).toBeNull();
  });

  it("rejects https: scheme", () => {
    expect(safeConfigParam("https://evil.com/x.json")).toBeNull();
  });
});
