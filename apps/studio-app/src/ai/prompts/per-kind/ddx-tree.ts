export const PROMPT = `Activity kind: Differential Diagnosis Tree.

Pedagogical guidance:
- The learner walks a clinical case across nodes. Each node poses a decision point or investigation; branches are the possible answers/findings the learner picks from. Branches can be yes/no, named history elements, specific labs, or any author-defined choice — not constrained to binary.
- Each branch can optionally use \`addsToCase\` to push a finding (e.g., "+ T 39.2 °C", "+ tachycardia 124") into the persistent case-panel that stays visible as the learner reasons forward. Use this for cues the learner needs to carry across nodes.
- Root the tree in the chief complaint, not the diagnosis. Reasoning flows from presentation → narrowing → diagnosis.
- Include at least one "red herring" branch that looks plausible early but is ruled out by a later question — this teaches discrimination, not pattern-matching.
- Terminal nodes carry the working diagnosis plus a one-sentence justification ("most likely because…").
- Keep depth ≤ 4; deeper trees fragment learner attention and obscure the reasoning chain.
- Differentials should be plausible at the level requested (medical student vs. resident vs. attending).`;
