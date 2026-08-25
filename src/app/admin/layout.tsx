import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin-nav";

/**
 * Server-side gate for every /admin route.
 *
 * This is the real check — it runs on the server with the caller's session and
 * asks the database. The proxy also redirects signed-out visitors away, but a
 * proxy alone is not an authorisation boundary: it can be bypassed by anything
 * that does not route through it, and Server Functions are POSTs to the page
 * they live on. Authorisation is enforced here and, ultimately, by RLS.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) redirect("/?auth_error=Supabase%20is%20not%20configured");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/?auth_error=Sign%20in%20as%20an%20admin%20to%20continue");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) redirect("/?auth_error=Admin%20access%20required");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-black/10 pb-4 dark:border-white/10">
        <span className="text-lg font-semibold">Admin</span>
        <AdminNav />
        <Link
          href="/admin/products/new"
          className="ml-auto flex h-10 items-center justify-center rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Add product
        </Link>
      </div>

      {children}
    </div>
  );
}
