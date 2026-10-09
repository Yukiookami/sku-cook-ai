import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { ApiError, isDatabaseUnavailable, validationIssues } from '../modules/common/errors.js';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.issues === undefined ? {} : { issues: error.issues }),
        },
      });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_INPUT',
          message: '请求参数不正确',
          issues: validationIssues(error),
        },
      });
    }
    if (isDatabaseUnavailable(error)) {
      request.log.error({ err: error }, 'Database unavailable');
      return reply.code(503).send({
        error: { code: 'SERVICE_UNAVAILABLE', message: '数据服务暂时不可用' },
      });
    }
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      if (error.statusCode >= 400 && error.statusCode < 500) {
        return reply.code(error.statusCode).send({
          error: {
            code: error.statusCode === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_REQUEST',
            message: error.statusCode === 413 ? '请求内容超过大小限制' : '请求格式不正确',
          },
        });
      }
    }
    request.log.error({ err: error }, 'Request failed');
    return reply.code(500).send({
      error: { code: 'INTERNAL_ERROR', message: '服务器暂时无法处理请求' },
    });
  });
  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({
      error: { code: 'NOT_FOUND', message: '请求的资源不存在' },
    });
  });
}
