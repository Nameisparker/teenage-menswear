import type { MetadataRoute } from "next";
import { getCategories, getProductSlugs } from "@/lib/catalog";
import { SITE_URL } from "@/lib/site";

// Regenerated on the same cadence as the catalog pages themselves.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, categories] = await Promise.all([
    getProductSlugs(),
    getCategories(),
  ]);

  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    {
      url: `${SITE_URL}/products`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...categories.map((category) => ({
      url: `${SITE_URL}/products?category=${category.value}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...slugs.map((slug) => ({
      url: `${SITE_URL}/products/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
