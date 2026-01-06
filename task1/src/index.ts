import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import { z } from "zod";
import bcrypt from "bcrypt";

dotenv.config();

// ------------------------
// DATABASE
// ------------------------
const sql = neon(process.env.DATABASE_URL!);

// ------------------------
// APP
// ------------------------
const app = new Hono();

// ------------------------
// SERVER
// ------------------------
serve({
  fetch: app.fetch,
  port: 3000,
});

console.log("Server running on http://localhost:3000");

// ------------------------
// ZOD SCHEMAS (Zod v4)
// ------------------------

// CREATE USER
const createUserSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Name is required" })
    .refine(val => val.trim().length > 0, {
      message: "Name cannot be empty or just spaces",
    }),

  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Invalid email" }),

  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
});

// UPDATE USER PARAMS
const updateUserParamsSchema = z.object({
  id: z.coerce.number().int({ message: "ID must be an integer" }),
});

// UPDATE USER BODY
const updateUserBodySchema = z.object({
  name: z
    .string()
    .min(1, { message: "Name cannot be blank" })
    .refine(val => val.trim().length > 0, {
      message: "Name cannot be empty or just spaces",
    })
    .optional(),

  email: z.string().email({ message: "Invalid email" }).optional(),
});

// DELETE USER PARAMS
const deleteUserParamsSchema = z.object({
  id: z.coerce.number().int({ message: "ID must be an integer" }),
});

// ------------------------
// ROUTES
// ------------------------

// CREATE USER
app.post("/users", async (c) => {
  try {
    const body = await c.req.json();
    const validation = createUserSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ errors: validation.error.format() }, 400);
    }

    const { name, email, password } = validation.data;

    // 🔐 HASH PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await sql`
      INSERT INTO users (name, email, password)
      VALUES (${name}, ${email}, ${hashedPassword})
      RETURNING id, name, email, created_at
    `;

    return c.json(newUser, 201);

  } catch (error: any) {
    if (error.message?.includes("duplicate key")) {
      return c.json({ error: "Email already exists" }, 400);
    }

    console.error(error);
    return c.json({ error: "Failed to create user" }, 500);
  }
});


// READ ALL USERS
app.get("/users", async (c) => {
  const users = await sql`
    SELECT id, name, email, created_at
    FROM users
  `;
  return c.json(users);
});

// UPDATE USER
app.put("/users/:id", async (c) => {
  try {
    // Validate ID
    const paramsValidation = updateUserParamsSchema.safeParse({
      id: c.req.param("id"),
    });

    if (!paramsValidation.success) {
      return c.json({ errors: paramsValidation.error.format() }, 400);
    }

    const { id } = paramsValidation.data;

    // Validate body
    const body = await c.req.json();
    const bodyValidation = updateUserBodySchema.safeParse(body);

    if (!bodyValidation.success) {
      return c.json({ errors: bodyValidation.error.format() }, 400);
    }

    const { name, email } = bodyValidation.data;

    const [updatedUser] = await sql`
      UPDATE users
      SET
        name = COALESCE(${name}, name),
        email = COALESCE(${email}, email)
      WHERE id = ${id}
      RETURNING id, name, email, created_at
    `;

    if (!updatedUser) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json(updatedUser, 200);

  } catch (error: any) {
    if (error.message?.includes("duplicate key")) {
      return c.json({ error: "Email already exists" }, 400);
    }

    console.error(error);
    return c.json({ error: "Failed to update user" }, 500);
  }
});

// DELETE USER
app.delete("/users/:id", async (c) => {
  try {
    const paramsValidation = deleteUserParamsSchema.safeParse({
      id: c.req.param("id"),
    });

    if (!paramsValidation.success) {
      return c.json({ errors: paramsValidation.error.format() }, 400);
    }

    const { id } = paramsValidation.data;

    const [deleted] = await sql`
      DELETE FROM users
      WHERE id = ${id}
      RETURNING id
    `;

    if (!deleted) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ message: "User deleted successfully" }, 200);

  } catch (error) {
    console.error(error);
    return c.json({ error: "Failed to delete user" }, 500);
  }
});
