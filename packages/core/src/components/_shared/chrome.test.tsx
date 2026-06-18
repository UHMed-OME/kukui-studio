import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityHeader } from "./ActivityHeader.js";
import { StatusBadge } from "./StatusBadge.js";
import { CheckIcon, ActivityIcon } from "./icons.js";

describe("ActivityHeader", () => {
  it("full variant renders a gradient banner with the kukui watermark", () => {
    const out = renderToStaticMarkup(
      <ActivityHeader title="Patient case" titleId="t" variant="full" meta="Week 1" />,
    );
    expect(out).toContain("kukui-actheader--full");
    expect(out).toContain("kukui-actheader__glyph");
    expect(out).toContain("Patient case");
    expect(out).toContain("Week 1");
    expect(out).toContain('id="t"');
    expect(out).toContain("<h1");
  });

  it("minimal variant omits the gradient watermark", () => {
    const out = renderToStaticMarkup(
      <ActivityHeader title="Plain" variant="minimal" />,
    );
    expect(out).toContain("kukui-actheader--minimal");
    expect(out).not.toContain("kukui-actheader__glyph");
    expect(out).toContain("Plain");
  });

  it("respects headingLevel and renders a badge slot", () => {
    const out = renderToStaticMarkup(
      <ActivityHeader
        title="Nested"
        headingLevel={2}
        badge={<StatusBadge tone="success">Complete</StatusBadge>}
      />,
    );
    expect(out).toContain("<h2");
    expect(out).toContain("kukui-actheader__badge");
    expect(out).toContain("Complete");
  });
});

describe("StatusBadge", () => {
  it("renders tone class, label, and icon", () => {
    const out = renderToStaticMarkup(
      <StatusBadge tone="success" icon={<CheckIcon />}>
        Passed
      </StatusBadge>,
    );
    expect(out).toContain("kukui-badge--success");
    expect(out).toContain("Passed");
    expect(out).toContain("kukui-badge__icon");
    expect(out).toContain("<svg");
  });

  it("ActivityIcon renders an emoji as text and a glyph code as a tinted svg", () => {
    expect(renderToStaticMarkup(<ActivityIcon value="🩺" />)).toContain("🩺");
    const glyph = renderToStaticMarkup(<ActivityIcon value="glyph:trophy:success" />);
    expect(glyph).toContain("<svg");
    expect(glyph).toContain("var(--color-success)");
  });

  it("defaults to neutral and supports the on-dark variant", () => {
    expect(renderToStaticMarkup(<StatusBadge>Idle</StatusBadge>)).toContain(
      "kukui-badge--neutral",
    );
    expect(
      renderToStaticMarkup(
        <StatusBadge tone="info" onDark>
          Live
        </StatusBadge>,
      ),
    ).toContain("is-on-dark");
  });
});
