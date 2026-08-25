import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Only allow same-origin paths back, so `next` cannot be an open redirect. */
function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

/**
 * Google (and any other OAuth provider) lands here with a PKCE `code`. The code
 * verifier was stored in a cookie by the browser client, so the exchange can
 * happen server-side and the session cookies are set on the redirect response.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const destination = new URL(next, url.origin);

  // `||`, not `??`: Google sends `error_description=` empty alongside a real
  // `error=access_denied`, and `??` would keep the empty string and let the
  // request fall through to the misleading "missing code" branch below.
  const providerError =
    url.searchParams.get("error_description") ||
    url.searchParams.get("error") ||
    null;
  if (providerError) {
    destination.searchParams.set("auth_error", providerError);
    return NextResponse.redirect(destination);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    destination.searchParams.set("auth_error", "Missing sign-in code.");
    return NextResponse.redirect(destination);
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    destination.searchParams.set("auth_error", "Sign-in is not configured.");
    return NextResponse.redirect(destination);
  }

  // Several sign-ins can be in flight at once; the flow id picks the right
  // verifier instead of falling back to the most recently stored one.
  const flowId = url.searchParams.get("sb_flow_id");
  const { error } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined
  );

  if (error) {
    destination.searchParams.set("auth_error", error.message);
  }

  return NextResponse.redirect(destination);
}
