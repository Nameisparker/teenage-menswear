import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing here is secret — /admin is gated server-side and /orders and
      // /cart are per-user — but they are worthless to a crawler and would
      // otherwise burn crawl budget on redirects.
      disallow: ["/admin", "/admin/", "/orders", "/orders/", "/cart", "/checkout", "/auth/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
