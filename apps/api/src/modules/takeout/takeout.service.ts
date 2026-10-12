import { createHash } from 'node:crypto';
import {
  TakeoutCandidateListResponseSchema,
  TakeoutCandidateSchema,
  TakeoutRandomResponseSchema,
  type ApiErrorIssue,
  type TakeoutCandidateInput,
  type TakeoutImportInput,
  type TakeoutRandomQuery,
} from '@sku-cook/shared';
import type { PrismaClient } from '@prisma/client';
import { ApiError, isTakeoutUrlUniqueViolation } from '../common/errors.js';
import { randomCandidateIndex } from '../common/random.js';
import { lockUser } from '../common/transaction.js';

const uniqueUrlConflict = () =>
  new ApiError(409, 'TAKEOUT_URL_CONFLICT', '这个分享链接已经添加过了');
const importValidationFailed = (issues: ApiErrorIssue[]) =>
  new ApiError(422, 'TAKEOUT_IMPORT_VALIDATION_FAILED', '校验未通过，未导入任何候选', issues);

function urlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

export function takeoutCandidateDto(record: {
  id: number;
  name: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return TakeoutCandidateSchema.parse({
    id: record.id,
    name: record.name,
    url: record.url,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export async function listTakeoutCandidates(client: PrismaClient, userId: number) {
  const records = await client.takeoutCandidate.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return TakeoutCandidateListResponseSchema.parse({ items: records.map(takeoutCandidateDto) });
}

export async function createTakeoutCandidate(
  client: PrismaClient,
  userId: number,
  input: TakeoutCandidateInput,
) {
  const hash = urlHash(input.url);
  try {
    const record = await client.$transaction(
      async (tx) => {
        await lockUser(tx, userId);
        const existing = await tx.takeoutCandidate.findFirst({
          where: { userId, urlHash: hash },
          select: { id: true },
        });
        if (existing) throw uniqueUrlConflict();
        return tx.takeoutCandidate.create({
          data: { userId, name: input.name, url: input.url, urlHash: hash },
        });
      },
      { timeout: 15_000 },
    );
    return takeoutCandidateDto(record);
  } catch (error) {
    if (isTakeoutUrlUniqueViolation(error)) throw uniqueUrlConflict();
    throw error;
  }
}

export async function updateTakeoutCandidate(
  client: PrismaClient,
  userId: number,
  id: number,
  input: TakeoutCandidateInput,
) {
  const hash = urlHash(input.url);
  try {
    const record = await client.$transaction(
      async (tx) => {
        await lockUser(tx, userId);
        const existing = await tx.takeoutCandidate.findFirst({
          where: { id, userId },
          select: { id: true },
        });
        if (!existing) throw new ApiError(404, 'TAKEOUT_CANDIDATE_NOT_FOUND', '候选不存在');
        const duplicate = await tx.takeoutCandidate.findFirst({
          where: { userId, urlHash: hash, id: { not: id } },
          select: { id: true },
        });
        if (duplicate) throw uniqueUrlConflict();
        return tx.takeoutCandidate.update({
          where: { id },
          data: { name: input.name, url: input.url, urlHash: hash },
        });
      },
      { timeout: 15_000 },
    );
    return takeoutCandidateDto(record);
  } catch (error) {
    if (isTakeoutUrlUniqueViolation(error)) throw uniqueUrlConflict();
    throw error;
  }
}

export async function deleteTakeoutCandidate(
  client: PrismaClient,
  userId: number,
  id: number,
): Promise<void> {
  await client.$transaction(
    async (tx) => {
      await lockUser(tx, userId);
      const result = await tx.takeoutCandidate.deleteMany({ where: { id, userId } });
      if (result.count === 0) {
        throw new ApiError(404, 'TAKEOUT_CANDIDATE_NOT_FOUND', '候选不存在');
      }
    },
    { timeout: 15_000 },
  );
}

export async function importTakeoutCandidates(
  client: PrismaClient,
  userId: number,
  input: TakeoutImportInput,
): Promise<{ importedCount: number }> {
  try {
    return await client.$transaction(
      async (tx) => {
        await lockUser(tx, userId);
        const hashes = input.candidates.map(({ url }) => urlHash(url));
        const indexesByHash = new Map<string, number>();
        const issues: ApiErrorIssue[] = [];
        hashes.forEach((hash, index) => {
          const previousIndex = indexesByHash.get(hash);
          if (previousIndex !== undefined) {
            issues.push({
              path: ['candidates', index, 'url'],
              message: `与第${previousIndex + 1}条候选的分享链接重复`,
            });
          } else {
            indexesByHash.set(hash, index);
          }
        });
        if (issues.length) throw importValidationFailed(issues);

        const existing = await tx.takeoutCandidate.findMany({
          where: { userId, urlHash: { in: hashes } },
          select: { urlHash: true },
        });
        for (const record of existing) {
          const index = indexesByHash.get(record.urlHash);
          if (index !== undefined) {
            issues.push({
              path: ['candidates', index, 'url'],
              message: '这个分享链接已经添加过了',
            });
          }
        }
        if (issues.length) throw importValidationFailed(issues);

        const now = new Date();
        const result = await tx.takeoutCandidate.createMany({
          data: input.candidates.map((candidate) => ({
            userId,
            name: candidate.name,
            url: candidate.url,
            urlHash: urlHash(candidate.url),
            updatedAt: now,
          })),
        });
        return { importedCount: result.count };
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    if (isTakeoutUrlUniqueViolation(error)) {
      throw new ApiError(409, 'TAKEOUT_URL_CONFLICT', '分享链接已被添加，请重新读取后重试');
    }
    throw error;
  }
}

export async function randomTakeoutCandidate(
  client: PrismaClient,
  userId: number,
  query: TakeoutRandomQuery,
) {
  const records = await client.takeoutCandidate.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  if (!records.length) {
    return TakeoutRandomResponseSchema.parse({ candidate: null, reason: 'EMPTY_LIBRARY' });
  }
  const alternatives =
    query.excludeCandidateId === undefined
      ? records
      : records.filter(({ id }) => id !== query.excludeCandidateId);
  if (!alternatives.length) {
    return TakeoutRandomResponseSchema.parse({ candidate: null, reason: 'NO_ALTERNATIVE' });
  }
  const selected = alternatives[randomCandidateIndex(alternatives.length)];
  if (!selected) throw new Error('Random candidate selection violated its index invariant');
  return TakeoutRandomResponseSchema.parse({
    candidate: takeoutCandidateDto(selected),
    reason: null,
  });
}
