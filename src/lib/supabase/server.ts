import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getCookie, setCookie } from "@tanstack/react-start/server";

/**
 * Server-side Supabase client using TanStack Start's cookie API.
 * Reads session from cookies on the incoming request.
 *
 * Usage in server functions:
 *   const supabase = await getSupabaseServer();
 *   const { data: { user } } = await supabase.auth.getUser();
 */
export async function getSupabaseServer() {
  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Read all cookies from the incoming request
          const cookieHeader = getCookie("Cookie") ?? "";
          if (!cookieHeader) return [];
          return cookieHeader.split(";").map((pair) => {
            const [name, ...rest] = pair.trim().split("=");
            return { name: name!, value: rest.join("=") };
          });
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              setCookie(name, value, {
                path: options?.path ?? "/",
                httpOnly: options?.httpOnly ?? true,
                secure: options?.secure ?? true,
                sameSite: (options?.sameSite as "lax" | "strict" | "none") ?? "lax",
                maxAge: options?.maxAge,
                domain: options?.domain,
              });
            });
          } catch {
            // setAll called from a Server Component — ignore
          }
        },
      },
    },
  );
}

/**
 * Create a Supabase client with service role key (admin operations).
 * USE SPARINGLY — bypasses RLS.
 */
export function getSupabaseAdmin() {
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
