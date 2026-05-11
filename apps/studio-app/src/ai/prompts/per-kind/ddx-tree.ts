export const PROMPT = `Activity kind: Differential Diagnosis Tree.

Pedagogical guidance:
- The learner refines a differential by asking diagnostic questions. Each node is a question (e.g., "fever?"), each branch a yes/no answer leading to either a narrower differential or a working diagnosis.
- Root the tree in the chief complaint, not the diagnosis. Reasoning flows from presentation → narrowing → diagnosis.
- Include at least one "red herring" branch that looks plausible early but is ruled out by a later question — this teaches discrimination, not pattern-matching.
- Terminal nodes carry the working diagnosis plus a one-sentence justification ("most likely because…").
- Keep depth ≤ 4; deeper trees fragment learner attention and obscure the reasoning chain.
- Differentials should be plausible at the level requested (medical student vs. resident vs. attending).`;
