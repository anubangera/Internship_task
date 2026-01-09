import z from "zod";
import { addressSchema } from "./addressSchema.js";


export const createUserSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Name is required" })
    .refine(val => val.trim().length > 0, {
      message: "Name cannot be empty or just spaces",
    }),

  email: z
    .email("Invalid email"),

  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
});


export const updateUserParamsSchema = z.object({
  id: z.coerce.number().int({ message: "ID must be an integer" }),
});


export const updateUserBodySchema = createUserSchema.extend({
})
// UPDATE USER BODY
// export const updateUserBodySchema = z.object({
//   name: z
//     .string()
//     .min(1, { message: "Name cannot be blank" })
//     .refine(val => val.trim().length > 0, {
//       message: "Name cannot be empty or just spaces",
//     })
//     .optional(),

//   email: z.string().email({ message: "Invalid email" }).optional(),
// });

// DELETE USER PARAMS
export const deleteUserParamsSchema = z.object({
  id: z.coerce.number().int({ message: "ID must be an integer" }),
});

//create user with address schema (transaction)
export const createUserWithAddressesSchema = createUserSchema.extend({
  addresses: z.array(addressSchema).min(1, {
    message: "At least one address is required",
  }),
});

