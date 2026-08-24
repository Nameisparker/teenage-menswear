/**
 * Supabase project credentials.
 *
 * These are `NEXT_PUBLIC_*` so they are inlined into the client bundle at build
 * time — which is fine, the anon key is designed to be public. Reference them
 * statically (never via a computed key) or the inlining will not happen.
 *
 * The whole auth layer degrades gracefully when they are missing so the
 * storefront still renders on a fresh clone with no `.env.local`.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
