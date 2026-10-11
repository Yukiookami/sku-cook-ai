import { z } from 'zod';

// ASCII 账号避免 Unicode 大小写/同形字符歧义；不 trim 密码或账号。
export const UsernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, '账号须以英文字母开头，仅含字母、数字和下划线');
export const PasswordSchema = z
  .string()
  .min(8)
  .max(128)
  .refine((value) => /\S/.test(value), '密码不能全为空白');
export const AuthCredentialsSchema = z
  .object({ username: UsernameSchema, password: PasswordSchema })
  .strict();
export const EmailSchema = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
export const LoginRequestSchema = z
  .object({
    username: z.union([UsernameSchema, EmailSchema]),
    password: PasswordSchema,
  })
  .strict();
export const RegisterRequestSchema = AuthCredentialsSchema.extend({ email: EmailSchema });
export const AuthUserSchema = z
  .object({
    id: z.number().int().positive(),
    username: UsernameSchema,
    email: EmailSchema.nullable().optional(),
    isSuperAdmin: z.boolean().optional(),
  })
  .strict();
export const AdminUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict();
export const AdminUserSchema = z
  .object({
    id: z.number().int().positive(),
    username: UsernameSchema,
    email: EmailSchema.nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export const AdminUsersResponseSchema = z
  .object({
    items: z.array(AdminUserSchema).max(20),
    page: z.number().int().positive(),
    hasMore: z.boolean(),
  })
  .strict();
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type AdminUsersResponse = z.infer<typeof AdminUsersResponseSchema>;
export const AuthResponseSchema = z.object({ user: AuthUserSchema }).strict();
export const UpdateUsernameRequestSchema = z.object({ username: UsernameSchema }).strict();
export const UpdateUsernameResponseSchema = AuthResponseSchema;
export const UpdatePasswordRequestSchema = z
  .object({ currentPassword: PasswordSchema, newPassword: PasswordSchema })
  .strict();
export const UpdatePasswordResponseSchema = AuthResponseSchema;
export type UpdateUsernameRequest = z.infer<typeof UpdateUsernameRequestSchema>;
export type UpdateUsernameResponse = z.infer<typeof UpdateUsernameResponseSchema>;
export type UpdatePasswordRequest = z.infer<typeof UpdatePasswordRequestSchema>;
export type UpdatePasswordResponse = z.infer<typeof UpdatePasswordResponseSchema>;
export type AuthCredentials = z.infer<typeof AuthCredentialsSchema>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
