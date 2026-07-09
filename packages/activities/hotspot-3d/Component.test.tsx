import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Hotspot3DConfig } from "./schema.js";
import Component, { resolveModelSource } from "./Component.js";

// JSDOM has no WebGL — these tests exercise the keyboard fallback list, which
// is the WCAG-required equivalent path. The 3D Canvas is rendered as a "scene
// unavailable" placeholder.
const cfg: Hotspot3DConfig = {
  version: "1.0",
  title: "Identify the part",
  prompt: "<p>Click the labeled part.</p>",
  model: { src: "models/test.glb" },
  hotspots: [
    {
      id: "iako",
      label: "Iako",
      position: { x: 0.3, y: 0.8, z: 0 },
      radius: 0.2,
      correct: true,
      feedback: "The cross-beam.",
    },
    {
      id: "ama",
      label: "Ama",
      position: { x: 1.2, y: 0, z: 0 },
      radius: 0.25,
      correct: false,
    },
  ],
  behaviour: { enableRetry: true },
};

describe("Hotspot3D — fallback list (select-then-confirm)", () => {
  it("renders title, prompt, fallback buttons, and Check disabled until a pick", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: /identify the part/i })).toBeInTheDocument();
    expect(screen.getByText(/click the labeled part/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^iako/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ama/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^check$/i })).toBeDisabled();
  });

  it("clicking a fallback button selects without submitting (Check stays available)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^iako/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^check$/i })).toBeEnabled();
  });

  it("Check on a correct selection scores 1/1 success and shows feedback", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^iako/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 1, max: 1, success: true });
    expect(screen.getByText(/the cross-beam/i)).toBeInTheDocument();
  });

  it("Check on a wrong selection scores 0/1 and reveals the correct answer", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Component config={cfg} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^ama/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ raw: 0, max: 1, success: false });
    expect(screen.getByText(/correct answer was/i)).toBeInTheDocument();
  });

  it("Try again resets state when enableRetry=true", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^ama/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByRole("button", { name: /^check$/i })).toBeDisabled();
  });

  it("persists state via onPersist on each pick", async () => {
    const user = userEvent.setup();
    const onPersist = vi.fn();
    render(<Component config={cfg} onSubmit={vi.fn()} onPersist={onPersist} />);
    await user.click(screen.getByRole("button", { name: /^iako/i }));
    expect(onPersist).toHaveBeenCalled();
    const last = onPersist.mock.calls.at(-1)?.[0] as string;
    expect(last).toMatch(/"selectedHotspotId":"iako"/);
  });
});

describe("Hotspot3D — scoring block (post-migration configs)", () => {
  it("renders Try Again when scoring.enableRetry is true and behaviour is absent", async () => {
    // Regression: Studio's migrator strips behaviour.enableRetry into
    // scoring.enableRetry. Reading config.behaviour directly hid the
    // retry button for every re-saved activity.
    const user = userEvent.setup();
    const migrated: Hotspot3DConfig = {
      ...cfg,
      behaviour: undefined,
      scoring: { mode: "points", enableRetry: true },
    };
    render(<Component config={migrated} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^ama/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("hides Try Again when scoring.enableRetry is false", async () => {
    const user = userEvent.setup();
    const noRetry: Hotspot3DConfig = {
      ...cfg,
      behaviour: undefined,
      scoring: { mode: "points", enableRetry: false },
    };
    render(<Component config={noRetry} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^ama/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
    // The actions row still shows the score line (row never collapses).
    expect(screen.getByText(/0 \/ 1/)).toBeInTheDocument();
  });

  it("shows an MC-style raw/max score line after submit", async () => {
    const user = userEvent.setup();
    render(<Component config={cfg} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /^iako/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));
    expect(screen.getByText(/1 \/ 1/)).toBeInTheDocument();
  });
});

describe("Hotspot3D — model source precedence", () => {
  const uid = "a1b2c3d4e5f67890abcdef1234567890";

  it("prefers the bundled GLB (model.src) when both src and sketchfabUid are set", () => {
    // SCORM export bundles the GLB at model.src while keeping the UID;
    // choosing the iframe would break offline packages.
    expect(
      resolveModelSource({ src: "./assets/model.glb", sketchfabUid: uid }),
    ).toEqual({ kind: "glb", src: "./assets/model.glb" });
  });

  it("uses the Sketchfab viewer when only sketchfabUid is set", () => {
    expect(resolveModelSource({ sketchfabUid: uid })).toEqual({
      kind: "sketchfab",
      uid,
    });
  });

  it("uses the GLB path when only src is set, and none when neither is", () => {
    expect(resolveModelSource({ src: "models/a.glb" })).toEqual({
      kind: "glb",
      src: "models/a.glb",
    });
    expect(resolveModelSource({})).toEqual({ kind: "none" });
  });
});

describe("Hotspot3D — suspend / resume", () => {
  it("restores a submitted attempt from suspendData", () => {
    const suspend = JSON.stringify({
      stage: "submitted",
      selectedHotspotId: "iako",
      attempts: 1,
    });
    render(<Component config={cfg} onSubmit={vi.fn()} suspendData={suspend} />);
    // Already submitted: no Check button, feedback + score visible.
    expect(screen.queryByRole("button", { name: /^check$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/the cross-beam/i)).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 1/)).toBeInTheDocument();
  });

  it("drops a persisted selection whose hotspot no longer exists", () => {
    const suspend = JSON.stringify({
      stage: "answering",
      selectedHotspotId: "deleted-hotspot",
      attempts: 0,
    });
    render(<Component config={cfg} onSubmit={vi.fn()} suspendData={suspend} />);
    // Selection was invalid, so Check stays disabled.
    expect(screen.getByRole("button", { name: /^check$/i })).toBeDisabled();
  });

  it("ignores malformed suspendData", () => {
    render(<Component config={cfg} onSubmit={vi.fn()} suspendData="{not json" />);
    expect(screen.getByRole("button", { name: /^check$/i })).toBeDisabled();
  });
});
