import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, "too_short")
  .max(MAX_PASSWORD_LENGTH, "too_long");

export const passwordChangeSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rotate"),
    newPassword: passwordSchema,
  }),
  z.object({
    action: z.literal("logout-others"),
  }),
]);

export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
