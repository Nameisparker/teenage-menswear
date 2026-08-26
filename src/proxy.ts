import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Env is read inline rather than imported: proxy runs separately from render
// code and should not rely on shared modules.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Keeps the Supabase session alive. Refreshed tokens are written back onto the
 * outgoing response here — without this, Server Components would read stale
 * cookies and users would get logged out at random.
 */
const GATED = ["/admin", "/orders"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return response;

  // Only routes that actually gate on auth need the round-trip to Supabase's
  // Auth API — running it on every public page (product pages, home, etc.)
  // was adding a full network request to every navigation for nothing.
  if (!GATED.some((path) => request.nextUrl.pathname.startsWith(path))) {
    return response;
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // No-store headers, so a CDN never serves one user's tokens to another.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Must run before the response is committed, or a refresh mid-flight is lost.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Bounce signed-out visitors away from gated areas so they get the sign-in
  // prompt rather than a redirect loop inside the layout.
  //
  // This is convenience, NOT authorisation: proxy runs outside render, and a
  // Server Function is a POST to the page it lives on, so a matcher change
  // could silently drop coverage. /admin is authorised in its layout and,
  // finally, by RLS — see app/admin/layout.tsx.
  if (!user) {
    const home = new URL("/", request.url);
    home.searchParams.set("auth_error", "Sign in to continue");
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
