"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Shows the `auth_error` that gets attached whenever someone is redirected away
 * from a gated page.
 *
 * Five places set this parameter — src/proxy.ts, the three redirects in
 * app/admin/layout.tsx, and app/auth/callback/route.ts — and nothing read it.
 * A non-admin who opened /admin was silently returned to the home page with no
 * idea why, and a failed Google sign-in looked like nothing had happened.
 *
 * Must stay inside a <Suspense> boundary: useSearchParams on a prerendered
 * route fails the production build otherwise. It works in dev either way, so
 * the mistake only shows up at build time.
 */
export function AuthErrorBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  const raw = searchParams.get("auth_error");
  if (!raw || dismissed) return null;

  // The value is attacker-controllable via a crafted link. React escapes it, so
  // there is no injection, but a long message could be used to dress up a
  // phishing sentence — cap it so it reads as a status, not a notice.
  const message = raw.slice(0, 160);

  function dismiss() {
    setDismissed(true);
    // Drop the parameter so a refresh, or a shared link, does not replay it.
    const next = new URLSearchParams(searchParams.toString());
    next.delete("auth_error");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10">
      <div className="mx-auto flex max-w-6xl items-start gap-4 px-4 py-3 sm:px-6">
        <p
          role="alert"
          className="flex-1 text-sm text-amber-900 dark:text-amber-200"
        >
          {message}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="text-sm font-medium text-amber-900 underline-offset-2 hover:underline dark:text-amber-200"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
