/**
 * Minimal valid config used as Studio's "new activity" template.
 */
const starter = {
  version: "1.0",
  title: "Video Reflection",
  prompt: "Record a short reflection responding to the prompt.",
  submissionTarget: "the course dropbox in Lamakū",
  maxDurationSeconds: 120,
  minDurationSeconds: 5,
  behaviour: { allowReRecord: true, allowScreenShare: true },
};

export default starter;
