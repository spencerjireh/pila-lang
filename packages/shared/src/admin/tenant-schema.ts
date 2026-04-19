import { z } from "zod";

export const createTenantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(3).max(32),
  timezone: z.string().trim().min(1),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const updateTenantSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    logoUrl: z.string().trim().url().nullable().optional(),
    accentColor: z.string().trim().optional(),
    timezone: z.string().trim().min(1).optional(),
    isDemo: z.boolean().optional(),
    isOpen: z.boolean().optional(),
  })
  .strict();

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
