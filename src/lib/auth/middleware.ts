import { createMiddleware } from "@tanstack/react-start";

/**
 * Auth middleware for server functions.
 * Verifies the Supabase session from cookies and provides the user id.
 *
 * Usage:
 *   import { createServerFn } from "@tanstack/react-start";
 *   import { authMiddleware } from "@/lib/auth/middleware";
 *
 *   export const myFunction = createServerFn({ method: "GET" })
 *     .middleware([authMiddleware])
 *     .handler(async ({ context }) => {
 *       // context.userId is the verified Supabase user id
 *     });
 */
export const authMiddleware = createMiddleware({ type: "function" })
  .server(async ({ next }) => {
    const { getSupabaseServer } = await import("@/lib/supabase/server");
    const supabase = await getSupabaseServer();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error("Unauthorized");
    }

    return next({ context: { userId: user.id } });
  });
