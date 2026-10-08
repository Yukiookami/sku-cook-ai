import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: { code: 'INVALID_INPUT', message: '请求参数不正确', issues: error.issues },
      });
    }
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      if (error.statusCode >= 400 && error.statusCode < 500) {
        return reply.code(error.statusCode).send({
          error: { code: 'INVALID_REQUEST', message: '请求格式不正确' },
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
