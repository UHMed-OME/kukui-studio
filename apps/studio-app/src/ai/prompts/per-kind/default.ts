/**
 * Fallback prompt fragment for activity kinds that lean heavily on media
 * (images, 3D models, video, audio, canvas drawings). The AI can help with
 * labels, hotspot prompts, and rationale text, but the author still has to
 * supply the media itself.
 *
 * Used for: hotspot-2d, hotspot-3d, anatomy-labeling, image-annotation,
 * image-comparison-slider, drag-and-drop, virtual-tour, interactive-video,
 * audio-recording, concept-map, and any activity kind we haven't given a
 * dedicated fragment.
 */
export const PROMPT = `Activity kind: media-backed activity.

Pedagogical guidance:
- This activity type relies on author-supplied media (images, 3D models, video, audio) that you cannot generate. If the current config has no media URL, use the literal placeholder string \`"PLACEHOLDER_URL"\` for image / model / video / audio URL fields and call the gap out in your accompanying response.
- You CAN author the textual content: hotspot prompts, labels, question stems, answer rationale, distractor explanations, learning-objective text. These are the highest-value AI contribution to media-backed activities.
- Hotspot / annotation coordinates: if the current config has them, preserve them unless asked to move them. If the config is empty, leave coordinate fields at safe defaults (centre of canvas / 0,0) and explicitly note that the author must position them.
- Keep prompts and labels concise — UI surfaces them in tight spaces; long strings will overflow on mobile.
- Distractor / wrong-answer rationale should still test specific misconceptions, same as text-only activities.`;
