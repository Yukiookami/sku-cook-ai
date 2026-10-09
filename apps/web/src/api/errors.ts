import axios from 'axios';
import { ApiErrorResponseSchema, type ApiErrorIssue } from '@sku-cook/shared';

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;

  const status = error.response?.status;
  if (status === 400) return '请求内容不符合要求，请检查填写内容后重试。';
  if (status === 404) return '内容已不存在，请刷新后重试。';
  if (status === 409) return '内容已发生变化，请重新读取后确认。';
  if (status === 413) return '提交内容过大，请缩减后重试。';
  if (status === 422) return '校验未通过，请根据提示修正后重试。';
  if (status === 503) return '服务暂不可用，请稍后重试。';
  if (status && status >= 500) return '服务暂时出错，请稍后重试。';
  return fallback;
}

export function apiErrorIssues(error: unknown): ApiErrorIssue[] {
  if (!axios.isAxiosError(error)) return [];
  const parsed = ApiErrorResponseSchema.safeParse(error.response?.data);
  return parsed.success ? (parsed.data.error.issues ?? []) : [];
}
