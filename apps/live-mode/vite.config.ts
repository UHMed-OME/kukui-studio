import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// In the Pages deploy, live-mode is mounted at `/live/` so Studio's
// "Launch in Kukui Live" buttons resolve correctly. The CI workflow
// sets `KUKUI_LIVE_BASE=/live/`; locally `pnpm dev` skips this and
// uses Vite's default `./` so the dev server serves at /.
const base = process.env.KUKUI_LIVE_BASE ?? "./";

// Deployment version stamp — surfaced in the live activity footer so
// learners + instructors can report which build they're on. CI sets
// `VITE_KUKUI_VERSION` to the short commit SHA before `vite build`.
// Locally `pnpm dev` leaves it unset and the footer shows "dev".
export default defineConfig({
  base,
  define: {
    "import.meta.env.VITE_KUKUI_VERSION": JSON.stringify(
      process.env.VITE_KUKUI_VERSION ?? "dev",
    ),
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    strictPort: false,
  },
});
