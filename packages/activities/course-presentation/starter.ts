/**
 * Minimal valid config used as Studio's "new activity" template. A single
 * blank title slide — the author builds the real deck by importing a PDF /
 * PowerPoint / Google Slides deck on the Edit canvas, then dropping info
 * hotspots and checkpoints onto the slides.
 */
const starter = {
  version: "1.0",
  title: "Course Presentation",
  slides: [
    {
      id: "slide-1",
      title: "Welcome",
      background: { kind: "blank" },
      notes:
        "<p>Open the <strong>Edit</strong> tab and import a PDF, PowerPoint export, or Google Slides link to build your deck. Then drop info hotspots and question checkpoints onto each slide.</p>",
      // Overlays are placed on the canvas; a fresh deck starts with none.
      overlays: [],
    },
  ],
  // Seeded so Studio's RJSF form loads clean: z.toJSONSchema marks a
  // .default() field as `required`, so AJV flags a missing `appearance` on
  // load even though Zod fills the default. (Same pattern as clinical-case's
  // starter.)
  appearance: { theme: "auto" },
};

export default starter;
