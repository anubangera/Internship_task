// src/middleware/logger.ts
import type { Context, Next } from "hono";

export const logger = async (c: Context, next: Next) => {
  const start = Date.now(); // Start time

  // Call the next middleware or route
  const res = await next();

  const duration = Date.now() - start; // Execution time in ms
  const method = c.req.method; // GET, POST, etc.
  const path = c.req.url.split("?")[0]; // Path without query
  const queryParams = c.req.query(); // Query parameters as an object

  // Sanitize sensitive info (optional)
  if (queryParams.password) queryParams.password = "***";

 const status = c.res.status || 200;// Response status code
  const timestamp = new Date().toLocaleTimeString();

  // Print log
  console.log(
    `[${timestamp}] ${method} ${path} ${status} ${duration}ms`,
    Object.keys(queryParams).length ? queryParams : ""
  );

  return res; // Send response to client
};
