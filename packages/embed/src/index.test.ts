import { afterEach, describe, expect, it, vi } from "vitest";
import { KukuiActivityElement, defineKukuiActivity } from "./index.js";

defineKukuiActivity();

afterEach(() => {
  document.body.innerHTML = "";
});

function mount(html: string): KukuiActivityElement {
  document.body.innerHTML = html;
  return document.body.querySelector("kukui-activity") as KukuiActivityElement;
}

describe("<kukui-activity>", () => {
  it("registers the custom element", () => {
    expect(customElements.get("kukui-activity")).toBe(KukuiActivityElement);
  });

  it("creates a sandboxed iframe pointing at src", () => {
    const el = mount('<kukui-activity eager src="https://host.example.com/mc/"></kukui-activity>');
    const iframe = el.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("src")).toBe("https://host.example.com/mc/");
    expect(iframe?.getAttribute("sandbox")).toContain("allow-scripts");
    expect(iframe?.getAttribute("sandbox")).toContain("allow-same-origin");
    expect(iframe?.title).toBe("Kukui activity");
  });

  it("honours height and allow attributes", () => {
    const el = mount(
      '<kukui-activity eager src="https://h/x/" height="800" allow="camera; microphone" title="Reflection"></kukui-activity>',
    );
    const iframe = el.querySelector("iframe");
    expect(iframe?.style.height).toBe("800px");
    expect(iframe?.getAttribute("allow")).toBe("camera; microphone");
    expect(iframe?.title).toBe("Reflection");
  });

  it("defaults height to 640 when absent or invalid", () => {
    const el = mount('<kukui-activity eager src="https://h/x/" height="oops"></kukui-activity>');
    expect(el.querySelector("iframe")?.style.height).toBe("640px");
  });

  it("renders an error and no iframe when src is missing", () => {
    const el = mount("<kukui-activity eager></kukui-activity>");
    expect(el.querySelector("iframe")).toBeNull();
    expect(el.textContent).toContain("missing required");
  });

  it("updates the iframe in place when src changes after mount", () => {
    const el = mount('<kukui-activity eager src="https://h/a/"></kukui-activity>');
    el.setAttribute("src", "https://h/b/");
    expect(el.querySelector("iframe")?.getAttribute("src")).toBe("https://h/b/");
  });

  it("rejects non-http(s) src schemes", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const el = mount(
      '<kukui-activity eager src="javascript:alert(1)"></kukui-activity>',
      );
      expect(el.querySelector("iframe")).toBeNull();
      expect(el.textContent).toContain("must be an http(s) URL");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("recovers when src is set after a failed eager mount", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const el = mount("<kukui-activity eager></kukui-activity>");
      expect(el.querySelector("iframe")).toBeNull();
      el.setAttribute("src", "https://h/x/");
      const iframe = el.querySelector("iframe");
      expect(iframe).not.toBeNull();
      expect(iframe?.getAttribute("src")).toBe("https://h/x/");
      expect(el.textContent).not.toContain("missing required");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("does not reassign iframe.src on unrelated attribute changes", () => {
    const el = mount('<kukui-activity eager src="https://h/a/"></kukui-activity>');
    expect(el.querySelector("iframe")).not.toBeNull();
    const srcSetter = vi.spyOn(HTMLIFrameElement.prototype, "src", "set");
    try {
      el.setAttribute("height", "900");
      el.setAttribute("title", "Renamed");
      expect(srcSetter).not.toHaveBeenCalled();
      // Changing src itself still reassigns.
      el.setAttribute("src", "https://h/b/");
      expect(srcSetter).toHaveBeenCalledTimes(1);
    } finally {
      srcSetter.mockRestore();
    }
  });

  describe("kukui:resize messages", () => {
    function mountWithIframe() {
      const el = mount(
        '<kukui-activity eager src="https://host.example.com/mc/"></kukui-activity>',
      );
      const iframe = el.querySelector("iframe") as HTMLIFrameElement;
      expect(iframe).not.toBeNull();
      return { el, iframe };
    }

    function sendResize(
      iframe: HTMLIFrameElement,
      origin: string,
      height: unknown,
    ) {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "kukui:resize", height },
          origin,
          source: iframe.contentWindow,
        }),
      );
    }

    it("resizes when the message origin matches the src origin", () => {
      const { iframe } = mountWithIframe();
      sendResize(iframe, "https://host.example.com", 900);
      expect(iframe.style.height).toBe("900px");
    });

    it("ignores messages from a different origin", () => {
      const { iframe } = mountWithIframe();
      sendResize(iframe, "https://evil.example.com", 900);
      expect(iframe.style.height).toBe("640px");
    });

    it("ignores messages from a different source window", () => {
      const { iframe } = mountWithIframe();
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "kukui:resize", height: 900 },
          origin: "https://host.example.com",
          source: null,
        }),
      );
      expect(iframe.style.height).toBe("640px");
    });

    it("clamps requested heights to 10000px", () => {
      const { iframe } = mountWithIframe();
      sendResize(iframe, "https://host.example.com", 50000);
      expect(iframe.style.height).toBe("10000px");
    });

    it("ignores non-positive or non-numeric heights", () => {
      const { iframe } = mountWithIframe();
      sendResize(iframe, "https://host.example.com", -5);
      sendResize(iframe, "https://host.example.com", "huge");
      expect(iframe.style.height).toBe("640px");
    });
  });
});
