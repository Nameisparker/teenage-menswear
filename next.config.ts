import type { NextConfig } from "next";

/**
 * Response headers applied to every route.
 *
 * These are defence-in-depth, not a substitute for the server-side checks in
 * app/admin/layout.tsx and RLS. They close off the browser-side attacks that
 * application code cannot: framing, MIME sniffing, and referrer leakage.
 *
 * No Content-Security-Policy is set here on purpose. Next injects inline
 * bootstrap scripts, so a useful CSP needs a per-request nonce threaded through
 * the proxy — worth doing, but a header list is the wrong place to fake it. A
 * broken CSP that has to be disabled in a hurry is worse than none.
 */
const securityHeaders = [
  // Clickjacking: nothing here is meant to be framed.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Stop the browser second-guessing declared content types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin cross-site, the full path same-origin. Order URLs and
  // auth callbacks carry identifiers that should not reach third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing in this store uses these; deny them rather than leave them open.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Only meaningful over HTTPS; hosts serving plain HTTP ignore it.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/**
 * Host of the Supabase project, for the image optimiser's allowlist. Empty on a
 * clone with no .env.local, which is fine — there are no uploads to serve.
 */
const supabaseHost = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // The version banner is free reconnaissance for anyone scanning.
  poweredByHeader: false,

  // Admin-uploaded product images come from Supabase Storage, so the optimiser
  // has to be told that host is legitimate. Anything still under public/ is
  // untouched by this.
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https" as const,
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
