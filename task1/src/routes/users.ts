import { Hono } from "hono";
import { neon, type NeonQueryFunctionInTransaction } from "@neondatabase/serverless";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { pool } from "../db.js";
import {
  createUserSchema,
  updateUserParamsSchema,
  updateUserBodySchema,
  deleteUserParamsSchema,
  createUserWithAddressesSchema
} from "../schemas/userSchema.js";
import address from "./address.js";
import { error } from "console";


dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const users = new Hono()


// .route("/address",address)
/* -------- CREATE USER -------- */
users.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ errors: parsed.error.format() }, 400);
    }

    const { name, email, password } = parsed.data;
    const hashedPassword = await bcrypt.hash(password, 10);

    const [user] = await sql`
      INSERT INTO users (name, email, password)
      VALUES (${name}, ${email}, ${hashedPassword})
      RETURNING id, name, email, created_at
    `;

    return c.json(user, 201);

  } catch (err: any) {
    // ✅ Handle unique email constraint
    if (err.code === "23505") {
      return c.json({ error: "Email already exists" }, 409);
    }

    // fallback for unexpected errors
    console.error("Unexpected error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});





/* -------- GET USERS -------- */
users.get("/", async (c) => {
  const usersList = await sql`
    SELECT id, name, email, created_at FROM users
  `;
  return c.json(usersList);
});

/* -------- UPDATE USER -------- */
users.put("/:id", async (c) => {
  const params = updateUserParamsSchema.safeParse({
    id: c.req.param("id"),
  });

  if (!params.success) {
    return c.json({ errors: params.error.format() }, 400);
  }

  const body = await c.req.json();
  const parsed = updateUserBodySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ errors: parsed.error.format() }, 400);
  }

  const { name, email } = parsed.data;

try {
  const [user] = await sql`
    UPDATE users
    SET
      name = COALESCE(${name}, name),
      email = COALESCE(${email}, email)
    WHERE id = ${params.data.id}
    RETURNING id, name, email, created_at
  `;

  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);

} catch (err: any) {
  if (err.code === "23505") {
    return c.json({ error: "Email already exists" }, 409);
  }
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
}
});

/* -------- DELETE USER -------- */
users.delete("/:id", async (c) => {
  const params = deleteUserParamsSchema.safeParse({
    id: c.req.param("id"),
  });

  if (!params.success) {
    return c.json({ errors: params.error.format() }, 400);
  }

  const [deleted] = await sql`
    DELETE FROM users WHERE id = ${params.data.id} RETURNING id
  `;

  if (!deleted) return c.json({ error: "User not found" }, 404);
  return c.json({ message: "User deleted successfully" });
});


users.post("/with-addresses", async (c) => {
  const client = await pool.connect();

  try {
    // Parse and validate request body
    const body = await c.req.json();
    const parsed = createUserWithAddressesSchema.safeParse(body);

    if (!parsed.success) {
  const errors = parsed.error.format(); // structured nested error object
  return c.json({ errors }, 400);
}
    const { name, email, password, addresses } = parsed.data;

    // 2️ Start transaction
    await client.query("BEGIN");

    // 3️ Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    const pass=await bcrypt.compare("1234",hashedPassword)
    console.log(pass)
    // 4️⃣ Insert user into DB
    const userResult = await client.query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, hashedPassword]
    );

    const insertedUser = userResult.rows[0];
    const userId = insertedUser.id;

    if (!userId) throw new Error("Failed to insert user");

    // 5️⃣ Insert addresses
    const insertedAddresses = [];
    for (const addr of addresses) {
      const addressResult = await client.query(
        `INSERT INTO addresses 
         (user_id, address_line, city, state, postal_code, country)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, address_line, city, state, postal_code, country`,
        [
          userId,
          addr.addressLine,   // ✅ matches Zod schema
          addr.city,
          addr.state ?? null,
          addr.postalCode ?? null,
          addr.country ?? null,
        ]
      );
      insertedAddresses.push(addressResult.rows[0]);
    }

    // 6️⃣ Commit transaction
    await client.query("COMMIT");

    // 7️⃣ Return result
    return c.json(
      {
        user: insertedUser,
        addresses: insertedAddresses,
      },
      201
    );

  } catch (err: any) {
    // Rollback if anything fails
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }
    console.error("Transaction failed:", err);

    return c.json(
      { error: err.message || "Transaction failed, rolled back" },
      500
    );
  } finally {
    client.release();
  }
});






export default users;
