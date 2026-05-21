/**
 * Minimal valid config used as Studio's "new activity" template.
 *
 * Extracted verbatim from apps/studio-app/src/starters.ts.
 */
const starter = {
  version: "1.0",
  title: "Interactive Video",
  video: {
    src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    type: "html5",
  },
  interactions: [],
  behaviour: { enableRetry: true },
};

export default starter;
