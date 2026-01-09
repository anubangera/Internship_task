// src/schemas/addressSchema.ts
import { z } from "zod";

export const addressSchema = z.object({
  addressLine: z.string().min(1),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
}).partial();
