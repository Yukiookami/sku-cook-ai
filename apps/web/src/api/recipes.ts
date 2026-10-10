import type { AxiosProgressEvent } from 'axios';
import {
  RecipeIdParamsSchema,
  RecipeExportResponseSchema,
  type RecipeExportResponse,
  RecipeImportInputSchema,
  RecipeImportValidationRequestSchema,
  RecipeImportResponseSchema,
  RecipeImportValidationResponseSchema,
  RecipeInputSchema,
  RecipeListQuerySchema,
  RecipeListResponseSchema,
  RecipeRandomQuerySchema,
  RecipeRandomResponseSchema,
  RecipeResponseSchema,
  RecipeTagsResponseSchema,
  type Recipe,
  type RecipeImportInput,
  type RecipeImportResponse,
  type RecipeImportValidationRequest,
  type RecipeInput,
  type RecipeListResponse,
  type RecipeListQuery,
  type RecipeRandomResponse,
  type RecipeTagsResponse,
  type RecipeImportValidationResponse,
} from '@sku-cook/shared';
import { client } from './client';

export type TransferProgressCallback = (percent: number | null) => void;

function progressPercent(event: AxiosProgressEvent): number | null {
  if (!event.total || event.total <= 0) return null;
  return Math.min(100, Math.round((event.loaded / event.total) * 100));
}

export async function getRecipes(query: RecipeListQuery): Promise<RecipeListResponse> {
  const params = RecipeListQuerySchema.parse(query);
  const { data } = await client.get<unknown>('/recipes', { params });
  return RecipeListResponseSchema.parse(data);
}

export async function getRecipeTags(): Promise<RecipeTagsResponse> {
  const { data } = await client.get<unknown>('/recipes/tags');
  return RecipeTagsResponseSchema.parse(data);
}

export async function getRecipe(id: number): Promise<Recipe> {
  const params = RecipeIdParamsSchema.parse({ id });
  const { data } = await client.get<unknown>(`/recipes/${params.id}`);
  return RecipeResponseSchema.parse(data).recipe;
}

export async function createRecipe(input: RecipeInput): Promise<Recipe> {
  const body = RecipeInputSchema.parse(input);
  const { data } = await client.post<unknown>('/recipes', body);
  return RecipeResponseSchema.parse(data).recipe;
}

export async function updateRecipe(id: number, input: RecipeInput): Promise<Recipe> {
  const params = RecipeIdParamsSchema.parse({ id });
  const body = RecipeInputSchema.parse(input);
  const { data } = await client.put<unknown>(`/recipes/${params.id}`, body);
  return RecipeResponseSchema.parse(data).recipe;
}

export async function deleteRecipe(id: number): Promise<void> {
  const params = RecipeIdParamsSchema.parse({ id });
  await client.delete(`/recipes/${params.id}`);
}

export async function getRandomRecipe(excludeRecipeId?: number): Promise<RecipeRandomResponse> {
  const query = RecipeRandomQuerySchema.parse(
    excludeRecipeId === undefined ? {} : { excludeRecipeId },
  );
  const { data } = await client.get<unknown>('/recipes/random', { params: query });
  return RecipeRandomResponseSchema.parse(data);
}

export async function exportRecipes(
  onDownloadProgress?: TransferProgressCallback,
): Promise<RecipeExportResponse> {
  const { data } = await client.get<unknown>('/recipes/export', {
    onDownloadProgress: onDownloadProgress
      ? (event) => onDownloadProgress(progressPercent(event))
      : undefined,
  });
  return RecipeExportResponseSchema.parse(data);
}

export async function validateRecipeImport(
  input: RecipeImportValidationRequest,
  onUploadProgress?: TransferProgressCallback,
): Promise<RecipeImportValidationResponse> {
  const body = RecipeImportValidationRequestSchema.parse(input);
  const { data } = await client.post<unknown>('/recipes/import/validate', body, {
    onUploadProgress: onUploadProgress
      ? (event) => onUploadProgress(progressPercent(event))
      : undefined,
  });
  return RecipeImportValidationResponseSchema.parse(data);
}

export async function importRecipes(
  input: RecipeImportInput,
  onUploadProgress?: TransferProgressCallback,
): Promise<RecipeImportResponse> {
  const body = RecipeImportInputSchema.parse(input);
  const { data } = await client.post<unknown>('/recipes/import', body, {
    onUploadProgress: onUploadProgress
      ? (event) => onUploadProgress(progressPercent(event))
      : undefined,
  });
  return RecipeImportResponseSchema.parse(data);
}
