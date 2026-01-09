import { Hono } from "hono";
import { serve } from "@hono/node-server";
import dotenv from "dotenv";
import users from "./routes/users.js";
import address from "./routes/address.js";
import { logger } from "./middleware/logger.js";
import { responseFormatter } from "./middleware/responseFormatter.js";

dotenv.config();

const app = new Hono();

app.use("*", responseFormatter);
app.use("*", logger);
app.route("/users", users);
app.route("/users", address);


serve({
  fetch: app.fetch,
  port: 3000,
});

console.log(" Server running on http://localhost:3000");
