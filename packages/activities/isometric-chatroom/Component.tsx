/**
 * Engine / Studio-preview view of the Isometric Chatroom.
 *
 * Isometric Chatroom is Live-only — there is no async/single-learner
 * engine experience to render. Until a real engine-side preview lands,
 * we delegate to the shared StubActivity placeholder so the engine
 * registry, SCORM packaging, and Studio Preview all have a renderable
 * component contract. The runtime classroom view lives at
 * `apps/live-mode/src/activities/IsometricChatroomLive.tsx`.
 *
 * Intentionally a thin re-export — swap this file out once a dedicated
 * engine component (e.g. a `LivePreviewCard` describing the room +
 * pointing learners to Kukui Live) is designed.
 */
import StubActivity from "@kukui/core/components/_stub";
export default StubActivity;
