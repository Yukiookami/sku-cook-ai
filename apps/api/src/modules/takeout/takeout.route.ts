import {
  TakeoutCandidateIdParamsSchema,
  TakeoutCandidateInputSchema,
  TakeoutCandidateResponseSchema,
  TakeoutEmptyQuerySchema,
  TAKEOUT_IMPORT_MAX_BYTES,
  TakeoutImportInputSchema,
  TakeoutImportResponseSchema,
  TakeoutRandomQuerySchema,
} from '@sku-cook/shared';
import type { FastifyInstance } from 'fastify';
import { authenticatedUser } from '../auth/auth.session.js';
import { ApiError, validationIssues } from '../common/errors.js';
import {
  createTakeoutCandidate,
  deleteTakeoutCandidate,
  importTakeoutCandidates,
  listTakeoutCandidates,
  randomTakeoutCandidate,
  updateTakeoutCandidate,
} from './takeout.service.js';

export async function takeoutRoutes(app: FastifyInstance) {
  app.get('/takeout/candidates', async (request) => {
    const userId = authenticatedUser(request).id;
    TakeoutEmptyQuerySchema.parse(request.query);
    return listTakeoutCandidates(app.prisma, userId);
  });

  app.post('/takeout/candidates', async (request, reply) => {
    const userId = authenticatedUser(request).id;
    TakeoutEmptyQuerySchema.parse(request.query);
    const input = TakeoutCandidateInputSchema.parse(request.body);
    const candidate = await createTakeoutCandidate(app.prisma, userId, input);
    return reply.code(201).send(TakeoutCandidateResponseSchema.parse({ candidate }));
  });

  app.put('/takeout/candidates/:id', async (request) => {
    const userId = authenticatedUser(request).id;
    TakeoutEmptyQuerySchema.parse(request.query);
    const { id } = TakeoutCandidateIdParamsSchema.parse(request.params);
    const input = TakeoutCandidateInputSchema.parse(request.body);
    const candidate = await updateTakeoutCandidate(app.prisma, userId, id, input);
    return TakeoutCandidateResponseSchema.parse({ candidate });
  });

  app.delete('/takeout/candidates/:id', async (request, reply) => {
    const userId = authenticatedUser(request).id;
    TakeoutEmptyQuerySchema.parse(request.query);
    const { id } = TakeoutCandidateIdParamsSchema.parse(request.params);
    await deleteTakeoutCandidate(app.prisma, userId, id);
    return reply.code(204).send();
  });

  app.get('/takeout/random', async (request) => {
    const userId = authenticatedUser(request).id;
    const query = TakeoutRandomQuerySchema.parse(request.query);
    return randomTakeoutCandidate(app.prisma, userId, query);
  });

  app.post(
    '/takeout/candidates/import',
    { bodyLimit: TAKEOUT_IMPORT_MAX_BYTES },
    async (request) => {
      const userId = authenticatedUser(request).id;
      TakeoutEmptyQuerySchema.parse(request.query);
      const parsed = TakeoutImportInputSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ApiError(
          422,
          'TAKEOUT_IMPORT_VALIDATION_FAILED',
          '校验未通过，未导入任何候选',
          validationIssues(parsed.error),
        );
      }
      const result = await importTakeoutCandidates(app.prisma, userId, parsed.data);
      return TakeoutImportResponseSchema.parse(result);
    },
  );
}
