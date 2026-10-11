import axios from 'axios';
import { ApiErrorResponseSchema } from '@sku-cook/shared';

export function accountErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const parsed = ApiErrorResponseSchema.safeParse(error.response?.data);
    if (parsed.success) return parsed.data.error.message;
    if (!error.response) return '无法连接服务，请检查网络后重试。';
  }
  return fallback;
}
