import { describe, expect, it } from "vitest";
import { SAFE_MEDIA_URL } from "./url.js";

const accepts = (v: string) => SAFE_MEDIA_URL.safeParse(v).success;

describe("SAFE_MEDIA_URL", () => {
  it("accepts absolute http(s) URLs", () => {
    expect(accepts("https://example.com/x.png")).toBe(true);
    expect(accepts("http://example.com/x.png")).toBe(true);
  });

  it("accepts data URLs for image/audio/video", () => {
    expect(accepts("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
    expect(accepts("data:audio/webm;base64,GkXf")).toBe(true);
    expect(accepts("data:text/html,<script>1</script>")).toBe(false);
  });

  it("accepts relative paths inside the SCORM package", () => {
    expect(accepts("images/kalo-leaf.png")).toBe(true);
    expect(accepts("scenes/loi-kalo.glb")).toBe(true);
    expect(accepts("samples/hotspot-3d/box.glb")).toBe(true);
  });

  it("rejects protocol-relative URLs", () => {
    expect(accepts("//evil.com/x.png")).toBe(false);
  });

  it("rejects leading-slash (root-relative) paths", () => {
    // Package media is always relative; a leading slash is either a
    // misconfiguration or the start of a protocol-relative URL.
    expect(accepts("/images/kalo-leaf.png")).toBe(false);
  });

  it("rejects traversals, schemes, and whitespace", () => {
    expect(accepts("../secrets.png")).toBe(false);
    expect(accepts("images/../../x.png")).toBe(false);
    expect(accepts("javascript:alert(1)")).toBe(false);
    expect(accepts("vbscript:msgbox")).toBe(false);
    expect(accepts("file:///etc/passwd")).toBe(false);
    expect(accepts("blob:https://example.com/uuid")).toBe(false);
    expect(accepts("images/a b.png")).toBe(false);
    expect(accepts("images\\x.png")).toBe(false);
    expect(accepts("")).toBe(false);
  });
});
