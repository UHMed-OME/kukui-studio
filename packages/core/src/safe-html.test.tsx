import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SafeSvg } from "./safe-html.js";

function render(svg: string, title?: string): string {
  return renderToStaticMarkup(<SafeSvg svg={svg} title={title} />);
}

describe("SafeSvg", () => {
  it("keeps benign shapes, paths, text, and viewBox", () => {
    const out = render(
      '<svg viewBox="0 0 100 50"><rect x="0" y="0" width="10" height="10"/>' +
        '<path d="M0 0 L10 10"/><text x="5" y="5">Aorta</text></svg>',
      "Anatomy diagram",
    );
    expect(out).toContain("<svg");
    expect(out).toContain("viewBox=\"0 0 100 50\"");
    expect(out).toContain("<rect");
    expect(out).toContain("<path");
    expect(out).toContain("Aorta");
    expect(out).toContain('role="img"');
    expect(out).toContain('aria-label="Anatomy diagram"');
  });

  it("strips <script> tags", () => {
    const out = render('<svg><script>alert(1)</script><rect/></svg>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("<rect");
  });

  it("strips event-handler attributes", () => {
    const out = render('<svg><rect onload="alert(1)" onclick="x()"/></svg>');
    expect(out).not.toContain("onload");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("alert(1)");
  });

  it("strips <foreignObject> (HTML/JS smuggling vector)", () => {
    const out = render(
      '<svg><foreignObject><body><img src=x onerror="alert(1)"></body></foreignObject><rect/></svg>',
    );
    expect(out.toLowerCase()).not.toContain("foreignobject");
    expect(out).not.toContain("onerror");
  });

  it("strips javascript: URIs in href", () => {
    const out = render('<svg><a href="javascript:alert(1)"><rect/></a></svg>');
    expect(out).not.toContain("javascript:");
  });

  it("marks decorative (no title) SVG aria-hidden", () => {
    const out = render("<svg><rect/></svg>");
    expect(out).toContain('aria-hidden="true"');
    expect(out).not.toContain("role=\"img\"");
  });
});
