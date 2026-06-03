import { describe, expect, it } from "vitest";
import { parseCollectConfig } from "./collect.js";

describe("parseCollectConfig", () => {
  it("returns undefined for empty / nullish input", () => {
    expect(parseCollectConfig(null)).toBeUndefined();
    expect(parseCollectConfig(undefined)).toBeUndefined();
    expect(parseCollectConfig("")).toBeUndefined();
  });

  it("returns undefined for non-JSON or non-object JSON", () => {
    expect(parseCollectConfig("{not json")).toBeUndefined();
    expect(parseCollectConfig("\"a string\"")).toBeUndefined();
    expect(parseCollectConfig("123")).toBeUndefined();
  });

  it("keeps a valid email", () => {
    expect(parseCollectConfig('{"email":"prof@uh.edu"}')).toEqual({ email: "prof@uh.edu" });
  });

  it("drops a malformed email", () => {
    expect(parseCollectConfig('{"email":"not-an-email"}')).toBeUndefined();
  });

  it("keeps https webhook and form, drops non-https", () => {
    expect(parseCollectConfig('{"webhook":"https://hooks.example.com/x"}')).toEqual({
      webhook: "https://hooks.example.com/x",
    });
    expect(parseCollectConfig('{"webhook":"http://insecure.example.com/x"}')).toBeUndefined();
    expect(parseCollectConfig('{"formUrl":"https://forms.gle/abc"}')).toEqual({
      formUrl: "https://forms.gle/abc",
    });
  });

  it("combines multiple valid channels and ignores junk keys", () => {
    expect(
      parseCollectConfig(
        '{"email":"prof@uh.edu","webhook":"https://h/x","extra":"ignored","formUrl":"javascript:alert(1)"}',
      ),
    ).toEqual({ email: "prof@uh.edu", webhook: "https://h/x" });
  });
});
