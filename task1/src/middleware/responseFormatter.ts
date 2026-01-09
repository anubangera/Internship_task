// src/middleware/responseFormatter.ts
import type { Context, Next } from "hono";
import type { StatusCode } from "hono/utils/http-status";

export const responseFormatter = async (c: Context, next: Next) => {
  try {
    // Call the route first
    await next();

    const res = c.res; // get the Response object returned by the route
    if (!res) {
      // If route did not return a Response, send default
      c.res = new Response(
        JSON.stringify({
          success: true,
          data: null,
          message: "Operation successful",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
      return;
    }

    // Try to read JSON body
    let body: any = null;
    try {
      body = await res.clone().json(); // clone in case body is already used
    } catch {
      body = null; // if body is not JSON
    }

    const success = res.status >= 200 && res.status < 300;

    const formattedResponse = {
      success,
      data: body,
      message: success ? "Operation successful" : "An error occurred",
    };

    // Replace the response with formatted JSON
    c.res = new Response(JSON.stringify(formattedResponse), {
      status: res.status as StatusCode,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    // Handle any errors in middleware or route
    const status = error.status ?? 500;
    c.res = new Response(
      JSON.stringify({
        success: false,
        data: null,
        message: error.message || "Internal Server Error",
      }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
