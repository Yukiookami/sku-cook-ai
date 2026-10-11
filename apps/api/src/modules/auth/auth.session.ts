import { AuthUserSchema, type AuthUser } from '@sku-cook/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '../common/errors.js';
import { hashSessionToken } from './auth.crypto.js';

const cookieName = 'sku_session';
const cookieMaxAge = 10 * 365 * 24 * 60 * 60;

declare module 'fastify' {
  interface FastifyRequest {
    authenticatedUser: AuthUser | null;
  }
}

export function sessionToken(request: FastifyRequest) {
  const values = (request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${cookieName}=`));
  if (values.length !== 1) return undefined;
  const token = values[0].slice(cookieName.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}

export function setSessionCookie(reply: FastifyReply, token: string | null, secure: boolean) {
  reply.header(
    'Set-Cookie',
    `${cookieName}=${token ?? ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? cookieMaxAge : 0}${secure ? '; Secure' : ''}`,
  );
}

export function authenticatedUser(request: FastifyRequest): AuthUser {
  if (!request.authenticatedUser) throw new ApiError(401, 'UNAUTHENTICATED', '请先登录');
  return request.authenticatedUser;
}

export function registerAuthentication(
  app: FastifyInstance,
  secure: boolean,
  allowedOrigin?: string,
) {
  app.decorateRequest('authenticatedUser', null);
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0];
    if (request.method === 'GET' && path === '/api/health') return;
    reply.header('Cache-Control', 'no-store');
    // SameSite 加上 Origin/Fetch-Metadata 检查，拒绝浏览器跨站写入（包括登录 CSRF）。
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.origin;
      const expected = allowedOrigin ?? `${request.protocol}://${request.host}`;
      if (
        request.headers['sec-fetch-site'] === 'cross-site' ||
        (origin !== undefined && origin !== expected)
      ) {
        throw new ApiError(403, 'INVALID_ORIGIN', '不允许跨站请求');
      }
    }
    const publicEntry =
      (request.method === 'POST' && ['/api/auth/register', '/api/auth/login'].includes(path)) ||
      (request.method === 'DELETE' && path === '/api/auth/session');
    if (publicEntry) return;
    const token = sessionToken(request);
    if (!token) throw new ApiError(401, 'UNAUTHENTICATED', '请先登录');
    const session = await app.prisma.authSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      select: { user: { select: { id: true, username: true, email: true, isSuperAdmin: true } } },
    });
    if (!session) {
      setSessionCookie(reply, null, secure);
      throw new ApiError(401, 'UNAUTHENTICATED', '请先登录');
    }
    request.authenticatedUser = AuthUserSchema.parse(session.user);
    // 长期持久 Cookie 滚动续期；数据库会话不设空闲或绝对到期时间。
    setSessionCookie(reply, token, secure);
  });
}
