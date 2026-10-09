import type { ApiErrorIssue } from '@sku-cook/shared';

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly issues?: ApiErrorIssue[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function badInput(issues: ApiErrorIssue[] = []) {
  return new ApiError(400, 'INVALID_INPUT', '请求参数不正确', issues);
}

export function validationIssues(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): ApiErrorIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((part) => (typeof part === 'number' ? part : String(part))),
    message: issue.message,
  }));
}

export function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

export function isRecipeTitleUniqueViolation(error: unknown): boolean {
  if (
    !isPrismaCode(error, 'P2002') ||
    typeof error !== 'object' ||
    error === null ||
    !('meta' in error)
  ) {
    return false;
  }
  const meta = error.meta;
  if (typeof meta !== 'object' || meta === null || !('target' in meta)) return false;
  const target = meta.target;
  return Array.isArray(target)
    ? (target.includes('user_id') && target.includes('title')) ||
        target.includes('recipes_user_id_title_key')
    : target === 'recipes_user_id_title_key';
}

export function isDatabaseUnavailable(error: unknown): boolean {
  return ['P1001', 'P1002', 'P1008', 'P1017'].some((code) => isPrismaCode(error, code));
}
