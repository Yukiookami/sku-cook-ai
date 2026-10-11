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
export const AuthUserSchema = z
  .object({ id: z.number().int().positive(), username: UsernameSchema })
  .strict();
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
