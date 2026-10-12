import {
  TakeoutCandidateIdParamsSchema,
  TakeoutCandidateInputSchema,
  TakeoutCandidateListResponseSchema,
  TakeoutCandidateResponseSchema,
  TakeoutEmptyQuerySchema,
  TakeoutImportInputSchema,
  TakeoutImportResponseSchema,
  TakeoutRandomQuerySchema,
  TakeoutRandomResponseSchema,
  type TakeoutCandidate,
  type TakeoutCandidateInput,
  type TakeoutImportInput,
  type TakeoutRandomResponse,
  type TakeoutRandomQuery,
} from '@sku-cook/shared';
import { client } from './client';

export async function getTakeoutCandidates(): Promise<TakeoutCandidate[]> {
  const params = TakeoutEmptyQuerySchema.parse({});
  const { data } = await client.get<unknown>('/takeout/candidates', { params });
  return TakeoutCandidateListResponseSchema.parse(data).items;
}

export async function createTakeoutCandidate(
  input: TakeoutCandidateInput,
): Promise<TakeoutCandidate> {
  const body = TakeoutCandidateInputSchema.parse(input);
  const { data } = await client.post<unknown>('/takeout/candidates', body);
  return TakeoutCandidateResponseSchema.parse(data).candidate;
}

export async function updateTakeoutCandidate(
  id: number,
  input: TakeoutCandidateInput,
): Promise<TakeoutCandidate> {
  const params = TakeoutCandidateIdParamsSchema.parse({ id });
  const body = TakeoutCandidateInputSchema.parse(input);
  const { data } = await client.put<unknown>(`/takeout/candidates/${params.id}`, body);
  return TakeoutCandidateResponseSchema.parse(data).candidate;
}

export async function deleteTakeoutCandidate(id: number): Promise<void> {
  const params = TakeoutCandidateIdParamsSchema.parse({ id });
  await client.delete(`/takeout/candidates/${params.id}`);
}

export async function getRandomTakeoutCandidate(
  query: TakeoutRandomQuery = {},
): Promise<TakeoutRandomResponse> {
  const params = TakeoutRandomQuerySchema.parse(query);
  const { data } = await client.get<unknown>('/takeout/random', { params });
  return TakeoutRandomResponseSchema.parse(data);
}

export async function importTakeoutCandidates(
  input: TakeoutImportInput,
): Promise<{ importedCount: number }> {
  const body = TakeoutImportInputSchema.parse(input);
  const { data } = await client.post<unknown>('/takeout/candidates/import', body);
  return TakeoutImportResponseSchema.parse(data);
}
