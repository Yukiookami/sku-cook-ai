import { z } from 'zod';

const PositiveIdSchema = z.number().int().positive();

export const TAKEOUT_IMPORT_MAX_CANDIDATES = 1000;
export const TAKEOUT_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

const TakeoutUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (value === '') return true;
    try {
      const parsed = new URL(value);
      return (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        parsed.hostname.length > 0 &&
        !parsed.username &&
        !parsed.password
      );
    } catch {
      return false;
    }
  }, '请输入有效的 HTTP 或 HTTPS 分享链接')
  .default('');

export const TakeoutCandidateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    url: TakeoutUrlSchema,
  })
  .strict();
export type TakeoutCandidateInput = z.infer<typeof TakeoutCandidateInputSchema>;

export const TakeoutCandidateSchema = TakeoutCandidateInputSchema.extend({
  id: PositiveIdSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).strict();
export type TakeoutCandidate = z.infer<typeof TakeoutCandidateSchema>;

export const TakeoutCandidateResponseSchema = z
  .object({ candidate: TakeoutCandidateSchema })
  .strict();
export type TakeoutCandidateResponse = z.infer<typeof TakeoutCandidateResponseSchema>;

export const TakeoutCandidateListResponseSchema = z
  .object({ items: z.array(TakeoutCandidateSchema) })
  .strict();
export type TakeoutCandidateListResponse = z.infer<typeof TakeoutCandidateListResponseSchema>;

export const TakeoutCandidateIdParamsSchema = z
  .object({ id: z.coerce.number().int().positive() })
  .strict();
export const TakeoutEmptyQuerySchema = z.object({}).strict();

export const TakeoutRandomQuerySchema = z
  .object({ excludeCandidateId: z.coerce.number().int().positive().optional() })
  .strict();
export type TakeoutRandomQuery = z.infer<typeof TakeoutRandomQuerySchema>;

export const TakeoutRandomResponseSchema = z.union([
  z.object({ candidate: TakeoutCandidateSchema, reason: z.null() }).strict(),
  z.object({ candidate: z.null(), reason: z.enum(['EMPTY_LIBRARY', 'NO_ALTERNATIVE']) }).strict(),
]);
export type TakeoutRandomResponse = z.infer<typeof TakeoutRandomResponseSchema>;

export const TakeoutImportInputSchema = z
  .object({
    version: z.literal(1),
    candidates: z.array(TakeoutCandidateInputSchema).min(1).max(TAKEOUT_IMPORT_MAX_CANDIDATES),
  })
  .strict();
export type TakeoutImportInput = z.infer<typeof TakeoutImportInputSchema>;

export const TakeoutImportResponseSchema = z
  .object({ importedCount: z.number().int().min(1).max(TAKEOUT_IMPORT_MAX_CANDIDATES) })
  .strict();
export type TakeoutImportResponse = z.infer<typeof TakeoutImportResponseSchema>;
