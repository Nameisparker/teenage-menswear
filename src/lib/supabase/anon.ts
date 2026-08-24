import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

let anonClient: SupabaseClient | null = null;

/**
 * Session-less client for reading public data (the catalog, store settings).
 *
 * Deliberately does NOT touch cookies. Reading cookies opts a route into
 * dynamic rendering, so using the request-scoped client for catalog reads would
 * quietly make every product page render per-request. The catalog is
 * world-readable under RLS, so no session is needed — which keeps these pages
 * statically renderable with revalidation.
 *
 * Never use this for anything user-specific: it has no session, so `auth.uid()`
 * is null and own-row policies will return nothing.
 */
export function getSupabaseAnonClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  anonClient ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return anonClient;
}
