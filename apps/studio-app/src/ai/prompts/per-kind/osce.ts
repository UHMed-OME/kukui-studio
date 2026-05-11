export const PROMPT = `Activity kind: OSCE (Objective Structured Clinical Examination) station.

Pedagogical guidance:
- An OSCE station presents a clinical scenario with a defined task: take a history, interpret findings, counsel a patient, perform a procedure step list.
- The station description should set scene, role, time-limit, and explicit task — same shape as real OSCE blueprints.
- The activity is **phase-structured**, not a single flat checklist. Typical phases: History → Examination → Closure (or History → Differential → Plan, etc.). Each phase exposes a set of "actions" the learner can perform; correct actions score points, irrelevant ones don't (and may incur a small anti-guess penalty via \`behaviour.guessPenalty\`).
- Per-phase actions are observable behaviors ("introduces self by name and role", "asks about chest pain radiation"), not internal states ("understands rapport"). Group them by clinical domain within each phase so debrief can target a specific gap.
- Set \`expectedOrder\` when the order of phases matters (it almost always does for OSCE — you don't counsel before examining). Order points are a small bonus, not the dominant score, so phase content stays the main signal.
- Include a standardised-patient blurb if the schema supports it — what the SP should say if asked X. Keeps responses consistent across practice runs.`;
