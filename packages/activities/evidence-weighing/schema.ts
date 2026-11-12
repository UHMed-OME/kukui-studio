import { z } from "zod";
import { ScoringSchema, AppearanceSchema } from "@kukui/schemas/shared";

const versionRe = /^\d+\.\d+(\.\d+)?$/;

const ScoreBand = z.object({
  from: z.number(),
  to: z.number(),
  message: z.string(),
});

export const EvidenceWeighingConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: z.string().regex(versionRe),
    title: z.string().min(1),
    author: z.string().optional(),
    ratings: z
      .array(
        z.object({
          id: z.string().trim().min(1),
          label: z.string().trim().min(1),
        })
        .strict(),
      )
      .min(2),
    claims: z
      .array(
        z.object({
          claim: z.string().min(1),
          evidence: z
            .array(
              z.object({
                text: z.string().min(1),
                expectedRating: z.string().min(1),
                feedback: z.string().optional(),
              })
              .strict(),
            )
            .min(1),
        })
        .strict(),
      )
      .min(1),
    behaviour: z
      .object({
        enableRetry: z.boolean().optional(),
        enableSolutionsButton: z.boolean().optional(),
      })
      .strict()
      .optional(),
    ui: z
      .object({
        checkAnswerButton: z.string().optional(),
        showSolutionButton: z.string().optional(),
        tryAgainButton: z.string().optional(),
      })
      .strict()
      .optional(),
    overallFeedback: z.array(ScoreBand).optional(),
    scoring: ScoringSchema.optional(),
    appearance: AppearanceSchema.default({ theme: "auto" }),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Check for duplicate rating IDs and labels
    const ratingIds = new Set<string>();
    const ratingLabels = new Set<string>();

    data.ratings.forEach((rating, index) => {
      const id = rating.id.trim();
      const label = rating.label.trim().toLowerCase();

      if (ratingIds.has(id)) {
        ctx.addIssue({
          code: "custom",
          path: ["ratings", index, "id"],
          message: "Rating IDs must be unique",
        });
      }
      if (ratingLabels.has(label)) {
        ctx.addIssue({
          code: "custom",
          path: ["ratings", index, "label"],
          message: "Rating labels must be unique",
        })
      }

      ratingIds.add(id);
      ratingLabels.add(label);
    });

    // Check that each evidence item references a defined rating
    const validRatings = new Set(data.ratings.map((rating) => rating.id));

    data.claims.forEach((claim, claimIndex) => {
      claim.evidence.forEach((item, evidenceIndex) => {
        if (!validRatings.has(item.expectedRating)) {
          ctx.addIssue({
            code: "custom",
            path: ["claims", claimIndex, "evidence", evidenceIndex, "expectedRating"],
            message: "Expected rating must match a defined rating",
          });
        }
      });
    });
  });

export type EvidenceWeighingConfig = z.infer<typeof EvidenceWeighingConfigSchema>;
