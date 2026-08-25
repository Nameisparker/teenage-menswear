/**
 * The store's public origin, for absolute URLs in metadata, robots, and the
 * sitemap. Relative URLs are not valid in any of those.
 *
 * Set NEXT_PUBLIC_SITE_URL in production. Vercel supplies VERCEL_PROJECT_
 * PRODUCTION_URL automatically, which covers the common deploy; localhost is
 * the last resort so a dev build still renders.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();
