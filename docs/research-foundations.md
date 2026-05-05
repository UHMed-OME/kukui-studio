# Research foundations

A brief, non-exhaustive scan of the educational-technology literature relevant to Kukui's design choices. Updated 2026-05-05.

## Key findings

### 1. Engagement collapses with friction

Research on browser-based interactive learning content in higher education found that **only ~1/3 of students completed interactive elements** when they required extra clicks or were not embedded inline. Engagement dropped sharply when content was accessed via hyperlinks rather than rendered in-context.

> Vlachopoulos & Kashefi (2024). *Effectiveness of interactive content in improving student learning outcomes in an online tertiary education setting*. Journal of Computing in Higher Education. <https://link.springer.com/article/10.1007/s12528-023-09361-6>

**Implication for Kukui:** Activities embed directly inside Lamakū as SCORM packages with zero student-side setup. No external links, no separate apps to install. The SCORM-into-D2L workflow already aligns with the friction-minimization pattern the research endorses.

### 2. Structured curriculum integration matters more than the tool itself

The same study found that **structured integration with existing teaching produces measurable academic gains**, while ad-hoc deployment does not. Tools alone are not pedagogy.

**Implication for Kukui:** Pair activities with JABSOM's existing curriculum patterns (problem-based learning, team-based learning) rather than offering them as standalone supplements. Kukui Live's TBL round explicitly mirrors the JABSOM TBL workflow.

### 3. Team-Based Learning is well-supported in medical education

Multiple recent (2022–2024) papers describe novel online and hybrid TBL implementations in med schools, with measurable engagement gains over lecture-only formats. The TBL pattern (individual → team consensus → discussion → final team answer) has tooling support across iSpring, custom systems, and now several open implementations.

> Li et al. (2021). *Rethinking Teaching Team-Based Learning: The Challenges and Strategies for Medical Education in a Pandemic*. AERA Open. <https://journals.sagepub.com/doi/full/10.1177/23328584211067207>
> Springer (2024). *Adapting Team-Based Learning for Medical Education: A Case Study with Scalable and Resource-Efficient Implementation*. Med Sci Educ. <https://link.springer.com/article/10.1007/s40670-024-02246-y>
> *A Novel Online System Implementation to Enhance Team-Based Learning at a Medical School*. PMC. <https://pmc.ncbi.nlm.nih.gov/articles/PMC12049677/>

**Implication for Kukui:** TBL round is a Phase 3 MVP activity in Kukui Live, not a future feature. The pedagogy is established; the tooling gap is what we're filling.

### 4. Synchronous virtual classroom evidence base (post-COVID)

A 2023 *MedEdPublish* paper synthesized 12 evidence-based tips for synchronous virtual classroom tools in med ed. The highest-ROI patterns identified:

- Instructor-controlled progression (not student-paced free-for-all)
- Low-friction polling embedded in flow (no separate Kahoot tab)
- Structured breakout / TBL rounds with a clear return-to-plenary signal
- Real-time aggregation visible to all participants

> *Twelve tips for using synchronous virtual classroom technologies in medical education*. PMC. <https://pmc.ncbi.nlm.nih.gov/articles/PMC10939628/>

**Implication for Kukui Live:** the instructor console, embedded polling, TBL round, and live aggregation features all map directly to research-endorsed patterns.

### 5. Accessibility is a recurring weak point in incumbent platforms

Major incumbent interactive-content authoring platforms repeatedly flag accessibility limitations in higher-ed deployments. Screen-reader compatibility and keyboard navigation are commonly absent or incomplete.

**Implication for Kukui:** WCAG 2.2 AA conformance from day 1 is not just compliance — it's a measurable differentiator backed by literature on what's missing in the current landscape. Easier to build in than retrofit.

### 6. Classroom Response Systems (CRS) — the broader "polling" lineage

Audience Response Systems / clickers / Kahoot-class polling have a 20-year research base. Findings consistently show:

- Participation rates rise with anonymous mode
- Low-stakes formative use produces better learning gains than high-stakes summative
- Aggregated visibility (histograms, word clouds) drives discussion better than individual reveal

> *Classroom Response System in a Super-Blended Learning and Teaching Model*. PMC. <https://pmc.ncbi.nlm.nih.gov/articles/PMC7711766/>

**Implication for Kukui Live:** anonymous-by-default join, aggregate visualization, formative framing (no high-stakes scoring on Live by default).

### 7. Adaptive learning is the leading edge but not yet mainstream

Adaptive sequencing — personalizing question difficulty per learner — is an active area of med-ed research but remains experimental. Implementation requires either large item banks, learner-modeling infrastructure, or both.

> Sharma et al. (2017). *Adaptive Learning in Medical Education: The Final Piece of Technology Enhanced Learning?* PMC. <https://pmc.ncbi.nlm.nih.gov/articles/PMC5849979/>

**Implication for Kukui:** Out of scope for MVP. Worth flagging as Phase 6+. JSON-driven content + Zod schemas leave the door open to adding adaptive logic later without rewiring the core.

### 8. Learning Management System (LMS) integration patterns

A 2024 scoping review of LMS use in med ed found that **integration depth matters more than feature breadth** — tools that live inside the LMS gradebook see materially higher engagement than those requiring separate logins.

> *Leveraging learning management systems in medical education: a scoping review of use, outcomes, and improvement pathways*. PMC. <https://pmc.ncbi.nlm.nih.gov/articles/PMC12713214/>

**Implication for Kukui:** SCORM-into-D2L is the right integration choice. Not a marketing point — a literature-backed efficacy point.

## Where Kukui's design positions vs. the research

| Research finding | Kukui's choice | Backed by literature? |
| --- | --- | --- |
| Friction kills engagement | SCORM-embedded, no extra clicks | ✅ |
| Curriculum integration matters | TBL round + JABSOM-aligned activity types | ✅ |
| TBL works in med ed | TBL round in Live MVP | ✅ |
| Accessibility is a weak point in incumbents | WCAG 2.2 AA from day 1 | ✅ |
| Anonymous + aggregate visualization | Live's instructor console + per-student SCORM identity for grades | ✅ |
| Adaptive learning is emerging but immature | Deferred to Phase 6+, infrastructure ready | ✅ defensible deferral |
| Real-time multiplayer aids classroom learning | Kukui Live | ✅ |

## What we're explicitly not building (and why)

- **Adaptive sequencing**: no validated item bank yet; defer until Phase 6+
- **Native xAPI / cmi5 emission**: SCORM 1.2 is sufficient for D2L; xAPI is future
- **Content marketplace**: not a research-backed need for the JABSOM context

## Open research questions worth piloting

1. Does TBL round in Kukui Live measurably outperform our current TBL workflow? Pre-post study possible during pilot.
2. Does WCAG 2.2 AA conformance correlate with engagement in students using assistive tech? IRB-light pilot possible.
3. Does in-D2L SCORM embedding outperform external-link interactive content for engagement? Comparison study against existing JABSOM workflow possible.

## Caveats

- This scan is a quick literature review, not a systematic review. Citations are recent (2017–2024) but not exhaustive.
- The Hawaiian / Pacific Islander health education literature was not deeply searched here — worth a separate scan tied to the cultural review process.
- Med-ed-specific virtual patient research (Aquifer, Body Interact ecosystem) was deliberately excluded — Kukui is not a virtual patient platform.
