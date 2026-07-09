import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SafeHtml, SafeSvg } from "./safe-html.js";

function render(svg: string, title?: string): string {
  return renderToStaticMarkup(<SafeSvg svg={svg} title={title} />);
}

function renderHtml(html: string): string {
  return renderToStaticMarkup(<SafeHtml html={html} />);
}

describe("SafeHtml", () => {
  it("keeps relative and fragment URLs (regression: scheme-only pin stripped them)", () => {
    expect(renderHtml('<a href="page.html">go</a>')).toContain('href="page.html"');
    expect(renderHtml('<a href="#footnote">note</a>')).toContain('href="#footnote"');
    expect(renderHtml('<img src="./pic.png" alt="x">')).toContain('src="./pic.png"');
  });

  it("keeps https/mailto/tel and strips other schemes", () => {
    expect(renderHtml('<a href="https://example.edu/a">a</a>')).toContain(
      'href="https://example.edu/a"',
    );
    expect(renderHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
    expect(renderHtml('<a href="ftp://host/f">x</a>')).not.toContain("ftp:");
  });

  it("strips script, event handlers, and style attributes", () => {
    const out = renderHtml('<p onclick="x()" style="color:red"><script>alert(1)</script>hi</p>');
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("<script");
    expect(out).toContain("hi");
  });

  it("drops id attributes (duplicate-id / aria spoofing surface)", () => {
    expect(renderHtml('<div id="root">x</div>')).not.toContain('id="root"');
  });

  it("force-appends noopener even when the author supplies rel", () => {
    const out = renderHtml('<a href="https://example.edu" rel="">x</a>');
    expect(out).toContain("noopener");
    expect(out).toContain("noreferrer");
  });
});

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

  it("strips <style> (inline-SVG styles apply document-wide)", () => {
    const out = render(
      "<svg><style>* { display: none !important; }</style><rect/></svg>",
    );
    expect(out).not.toContain("<style");
    expect(out).not.toContain("display: none");
    expect(out).toContain("<rect");
  });
});
