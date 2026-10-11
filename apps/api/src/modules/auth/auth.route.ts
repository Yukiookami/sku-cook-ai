import {
  AuthCredentialsSchema,
  AuthResponseSchema,
  UpdateUsernameRequestSchema,
  UpdateUsernameResponseSchema,
  UpdatePasswordRequestSchema,
  UpdatePasswordResponseSchema,
} from '@sku-cook/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hashSessionToken } from './auth.crypto.js';
import { login, register, updateUsername, updatePassword } from './auth.service.js';
import { authenticatedUser, sessionToken, setSessionCookie } from './auth.session.js';

const EmptyQuerySchema = z.object({}).strict();

export async function authRoutes(app: FastifyInstance, settings: { secureCookie: boolean }) {
  app.patch('/auth/username', { bodyLimit: 4096 }, async (request) => {
    const user = authenticatedUser(request);
    EmptyQuerySchema.parse(request.query);
    const input = UpdateUsernameRequestSchema.parse(request.body);
    return UpdateUsernameResponseSchema.parse({
      user: await updateUsername(app.prisma, user.id, input),
    });
  });
  app.put('/auth/password', { bodyLimit: 4096 }, async (request) => {
    const user = authenticatedUser(request);
    EmptyQuerySchema.parse(request.query);
    const input = UpdatePasswordRequestSchema.parse(request.body);
    return UpdatePasswordResponseSchema.parse({
      user: await updatePassword(app.prisma, user.id, input),
    });
  });
  app.post('/auth/register', { bodyLimit: 4096 }, async (request, reply) => {
    EmptyQuerySchema.parse(request.query);
    const input = AuthCredentialsSchema.parse(request.body);
    const result = await register(app.prisma, input, sessionToken(request));
    setSessionCookie(reply, result.token, settings.secureCookie);
    return reply.code(201).send(AuthResponseSchema.parse({ user: result.user }));
  });
  app.post('/auth/login', { bodyLimit: 4096 }, async (request, reply) => {
    EmptyQuerySchema.parse(request.query);
    const input = AuthCredentialsSchema.parse(request.body);
    const result = await login(app.prisma, input, sessionToken(request));
    setSessionCookie(reply, result.token, settings.secureCookie);
    return AuthResponseSchema.parse({ user: result.user });
  });
  app.get('/auth/session', async (request) => {
    EmptyQuerySchema.parse(request.query);
    return AuthResponseSchema.parse({ user: authenticatedUser(request) });
  });
  app.delete('/auth/session', async (request, reply) => {
    EmptyQuerySchema.parse(request.query);
    if (request.body !== undefined) z.object({}).strict().parse(request.body);
    const token = sessionToken(request);
    if (token)
      await app.prisma.authSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
    setSessionCookie(reply, null, settings.secureCookie);
    return reply.code(204).send();
  });
}
