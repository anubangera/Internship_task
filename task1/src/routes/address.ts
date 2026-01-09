// src/address.ts
import { Hono } from "hono";
import { pool } from "../db.js";
import { addressSchema } from "../schemas/addressSchema.js";
import { updateUserParamsSchema } from "../schemas/userSchema.js";

const address = new Hono();
async function userExists(userId: number) {
  const res = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
  return (res.rowCount ?? 0) > 0;
}
async function addressExists(userId: number, addressId: number) {
  const res = await pool.query(
    "SELECT id FROM addresses WHERE id = $1 AND user_id = $2",
    [addressId, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

// POST: Add address for a user
address.post("/:userId/addresses", async (c) => {
  console.log("post is hit");

  // Parse and validate userId param
  const parsedParams = updateUserParamsSchema.safeParse({
    id: c.req.param("userId").trim(),
  });

  if (!parsedParams.success) {
    return c.json({ errors: parsedParams.error.format() }, 400);
  }


  const userId = Number(parsedParams.data.id);
  if (isNaN(userId)) {
    return c.json({ error: "Invalid userId" }, 400);
  }
  if (!(await userExists(userId))) {
    return c.json({ error: "User does not exist" }, 404);
  }

  // Parse and validate body
  const body = await c.req.json();
  const parsedBody = addressSchema.safeParse(body);

  if (!parsedBody.success) {
    return c.json({ errors: parsedBody.error.format() }, 400);
  }

  const { addressLine, city, state, postalCode, country } = parsedBody.data;

  // Insert address into DB
  const result = await pool.query(
    `INSERT INTO addresses
     (user_id, address_line, city, state, postal_code, country)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, addressLine, city, state ?? null, postalCode ?? null, country ?? null]
  );

  return c.json(result.rows[0], 201);
});

// GET: Get all addresses for a user
address.get("/:userId/addresses", async (c) => {
  console.log("get  endpoint")
  // Parse and validate userId param
  const parsedParams = updateUserParamsSchema.safeParse({
    id: c.req.param("userId").trim(),
  });

  if (!parsedParams.success) {
    return c.json({ errors: parsedParams.error.format() }, 400);
  }


  const userId = Number(parsedParams.data.id);
  if (isNaN(userId)) {
    return c.json({ error: "Invalid userId" }, 400);
  }
  if (!(await userExists(userId))) {
    return c.json({ error: "User does not exist" }, 404);
  }

  // Fetch addresses from DB
  const result = await pool.query(
    `SELECT id, address_line, city, state, postal_code, country, created_at
     FROM addresses
     WHERE user_id = $1`,
    [userId]
  );

  return c.json(result.rows, 200);
});

//put
address.put("/:userId/addresses/:addressId", async (c) => {
  console.log("put endpint hit")
  const parsedParams = updateUserParamsSchema.safeParse({
    id: c.req.param("userId").trim(),
  });

  if (!parsedParams.success) {
    return c.json({ errors: parsedParams.error.format() }, 400);
  }


  const userId = Number(parsedParams.data.id);
  if (isNaN(userId)) {
    return c.json({ error: "Invalid userId" }, 400);
  }
  if (!(await userExists(userId))) {
    return c.json({ error: "User does not exist" }, 404);

  }
  const body = await c.req.json();
  const parsedBody = addressSchema.safeParse(body);

  if (!parsedBody.success) {
    return c.json({ errors: parsedBody.error.format() }, 400);
  }
  const addressId = Number(c.req.param("addressId")?.trim());
  if (isNaN(addressId)) return c.json({ error: "Invalid addressId" }, 400);

  const { addressLine, city, state, postalCode, country } = parsedBody.data;

  // Update address using COALESCE for partial updates
  const result = await pool.query(
    `UPDATE addresses
   SET
     address_line = COALESCE($1, address_line),
     city         = COALESCE($2, city),
     state        = COALESCE($3, state),
     postal_code  = COALESCE($4, postal_code),
     country      = COALESCE($5, country)
   WHERE id = $6 AND user_id = $7
   RETURNING id, address_line, city, state, postal_code, country, created_at`,
    [addressLine, city, state, postalCode, country, addressId, userId]
  );
  const address = result.rows[0];

  if (!address) return c.json({ error: "Address not found for this user" }, 404);
  return c.json(address, 200);
});

//delete
// DELETE: Delete an address for a user
address.delete("/:userId/addresses/:addressId", async (c) => {
  console.log("delete endpoint hit");

  // Parse and validate userId param
  const parsedParams = updateUserParamsSchema.safeParse({
    id: c.req.param("userId").trim(),
  });

  if (!parsedParams.success) {
    return c.json({ errors: parsedParams.error.format() }, 400);
  }

  const userId = Number(parsedParams.data.id);
  if (isNaN(userId)) {
    return c.json({ error: "Invalid userId" }, 400);
  }

  if (!(await userExists(userId))) {
    return c.json({ error: "User does not exist" }, 404);
  }

  // Parse and validate addressId param
  const addressId = Number(c.req.param("addressId")?.trim());
  if (isNaN(addressId)) {
    return c.json({ error: "Invalid addressId" }, 400);
  }

  // Check if address exists for this user
  if (!(await addressExists(userId, addressId))) {
    return c.json({ error: "Address not found for this user" }, 404);
  }

  // Delete address
  await pool.query(
    "DELETE FROM addresses WHERE id = $1 AND user_id = $2",
    [addressId, userId]
  );

  return c.json({ message: "Address deleted successfully" }, 200);
});


//count the number of address per user 
address.get("/count-per-user", async (c) => {
  console.log("count-per-user endpoint hit");

  const result = await pool.query(`
    SELECT u.id, u.name, COUNT(a.id) AS address_count
    FROM users u
    LEFT JOIN addresses a ON u.id = a.user_id
    GROUP BY u.id, u.name
    ORDER BY u.name
  `);

  return c.json(result.rows, 200);
});

//Get Users Who Do NOT Have Any Address
address.get("/no-add-user", async (c) => {
  console.log("count-per-user endpoint hit");

  const result = await pool.query(`
   SELECT u.id, u.name
    FROM users u
    LEFT JOIN addresses a ON u.id = a.user_id
    WHERE a.id IS NULL
    ORDER BY u.name
  `);

  return c.json(result.rows, 200);
});





export default address;  