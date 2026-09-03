/**
 * SEED SOURCE — not read at runtime any more.
 *
 * The storefront reads products from the database (see src/lib/catalog.ts).
 * This file is the input to `npm run seed:sql`, which regenerates
 * supabase/migrations/20260824000001_seed_catalog.sql. Edit here, regenerate,
 * re-apply.
 */
import type { Category, Product } from "./types";

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "shirts", label: "Shirts" },
  { value: "pants", label: "Pants" },
  { value: "tees", label: "Tees" },
  { value: "accessories", label: "Accessories" },
];

const SIZES_APPAREL = ["S", "M", "L", "XL", "XXL"];
const SIZES_PANTS = ["30", "32", "34", "36", "38"];
const SIZES_BELT = ["32", "34", "36", "38"];
const SIZES_ONE = ["One Size"];

/**
 * Seed rows carry only the columns a fresh database starts with. Discounts are
 * not seeded — an admin sets them from /admin/discounts, and offer_price is
 * derived by the database — so this is Product without its pricing extras.
 * Re-running the seed leaves existing discounts alone: its upsert never names
 * those columns.
 */
export type SeedProduct = Omit<
  Product,
  "discountPercent" | "offerPrice" | "stockBySize" | "images"
>;

export const PRODUCTS: SeedProduct[] = [
  // Shirts
  {
    id: "shirt-01",
    slug: "classic-oxford-shirt",
    name: "Classic Oxford Shirt",
    category: "shirts",
    price: 1799,
    description:
      "A crisp, tailored Oxford shirt in breathable cotton. Works equally well buttoned up for the office or layered open over a tee.",
    sizes: SIZES_APPAREL,
    image: "/products/shirts/shirt_01.jpg",
    featured: true,
  },
  {
    id: "shirt-02",
    slug: "crisp-white-poplin-shirt",
    name: "Crisp White Poplin Shirt",
    category: "shirts",
    price: 1899,
    description:
      "A clean white poplin button-down with a chest pocket, sharp enough for the office and easy to dress down.",
    sizes: SIZES_APPAREL,
    image: "/products/shirts/shirt_02.jpg",
  },
  {
    id: "shirt-03",
    slug: "jet-black-twill-shirt",
    name: "Jet Black Twill Shirt",
    category: "shirts",
    price: 2199,
    description:
      "A sleek black twill shirt with subtle sheen, tailored for evenings out or a sharp office look.",
    sizes: SIZES_APPAREL,
    image: "/products/shirts/shirt_03.jpg",
  },
  {
    id: "shirt-04",
    slug: "olive-herringbone-shirt",
    name: "Olive Herringbone Shirt",
    category: "shirts",
    price: 1999,
    description:
      "A muted olive-grey herringbone shirt with soft texture, versatile for smart-casual layering.",
    sizes: SIZES_APPAREL,
    image: "/products/shirts/shirt_04.jpg",
  },
  {
    id: "shirt-05",
    slug: "navy-stripe-poplin-shirt",
    name: "Navy Stripe Poplin Shirt",
    category: "shirts",
    price: 2099,
    description:
      "A bold navy shirt with crisp vertical stripes, cut for a tailored fit that stands out at the office.",
    sizes: SIZES_APPAREL,
    image: "/products/shirts/shirt_05.jpg",
    featured: true,
  },
  {
    id: "shirt-06",
    slug: "burgundy-flannel-shirt",
    name: "Burgundy Flannel Shirt",
    category: "shirts",
    price: 2299,
    description:
      "A rich burgundy flannel shirt with a soft brushed finish, perfect for layering through cooler months.",
    sizes: SIZES_APPAREL,
    image: "/products/shirts/shirt_06.jpg",
  },
  {
    id: "shirt-07",
    slug: "forest-green-linen-shirt",
    name: "Forest Green Linen Shirt",
    category: "shirts",
    price: 2399,
    description:
      "A deep forest-green shirt in a breathable linen-blend weave, sharp for both work and weekend wear.",
    sizes: SIZES_APPAREL,
    image: "/products/shirts/shirt_07.jpg",
  },
  {
    id: "shirt-08",
    slug: "tan-plaid-flannel-shirt",
    name: "Tan Plaid Flannel Shirt",
    category: "shirts",
    price: 2199,
    description:
      "A warm tan plaid flannel shirt with a brushed cotton feel, built for cozy layering in cold weather.",
    sizes: SIZES_APPAREL,
    image: "/products/shirts/shirt_08.jpg",
  },
  {
    id: "shirt-09",
    slug: "blue-check-flannel-shirt",
    name: "Blue Check Flannel Shirt",
    category: "shirts",
    price: 2099,
    description:
      "A soft blue-and-white check flannel shirt with a relaxed weekend feel and cozy brushed texture.",
    sizes: SIZES_APPAREL,
    image: "/products/shirts/shirt_09.jpg",
  },
  {
    id: "shirt-10",
    slug: "charcoal-print-shirt",
    name: "Charcoal Print Shirt",
    category: "shirts",
    price: 1999,
    description:
      "A charcoal shirt with a subtle tonal print, adding quiet texture to a versatile everyday layer.",
    sizes: SIZES_APPAREL,
    image: "/products/shirts/shirt_10.jpg",
  },

  // Tees
  {
    id: "tee-01",
    slug: "essential-crew-tee",
    name: "Essential Crew Tee",
    category: "tees",
    price: 799,
    description:
      "A heavyweight cotton crew-neck tee that holds its shape wash after wash. The wardrobe staple.",
    sizes: SIZES_APPAREL,
    image: "/products/tees/tee_01.jpg",
    featured: true,
  },
  {
    id: "tee-02",
    slug: "midnight-navy-crew-tee",
    name: "Midnight Navy Crew Tee",
    category: "tees",
    price: 849,
    description:
      "A heavyweight navy crew-neck tee that layers cleanly under jackets or stands alone on its own.",
    sizes: SIZES_APPAREL,
    image: "/products/tees/tee_02.jpg",
  },
  {
    id: "tee-03",
    slug: "heather-grey-crew-tee",
    name: "Heather Grey Crew Tee",
    category: "tees",
    price: 799,
    description:
      "A soft heather-grey tee in breathable cotton, an easy neutral base for any outfit.",
    sizes: SIZES_APPAREL,
    image: "/products/tees/tee_03.jpg",
  },
  {
    id: "tee-04",
    slug: "deep-pine-crew-tee",
    name: "Deep Pine Crew Tee",
    category: "tees",
    price: 899,
    description:
      "A deep pine-green tee with a substantial cotton weight that holds its shape wear after wear.",
    sizes: SIZES_APPAREL,
    image: "/products/tees/tee_04.jpg",
  },
  {
    id: "tee-05",
    slug: "sandstone-crew-tee",
    name: "Sandstone Crew Tee",
    category: "tees",
    price: 849,
    description:
      "A warm sandstone-beige tee in soft cotton, an easy neutral for layering or wearing solo.",
    sizes: SIZES_APPAREL,
    image: "/products/tees/tee_05.jpg",
  },
  {
    id: "tee-06",
    slug: "maroon-crew-tee",
    name: "Maroon Crew Tee",
    category: "tees",
    price: 899,
    description:
      "A rich maroon crew-neck tee with a smooth cotton finish, a warm alternative to the basics.",
    sizes: SIZES_APPAREL,
    image: "/products/tees/tee_06.jpg",
  },
  {
    id: "tee-07",
    slug: "olive-crew-tee",
    name: "Olive Crew Tee",
    category: "tees",
    price: 849,
    description:
      "A durable olive-green tee in combed cotton, an easy go-to for casual everyday wear.",
    sizes: SIZES_APPAREL,
    image: "/products/tees/tee_07.jpg",
  },
  {
    id: "tee-08",
    slug: "breton-stripe-tee",
    name: "Breton Stripe Tee",
    category: "tees",
    price: 999,
    description:
      "A classic black-and-white striped tee with a ringer neckline, a timeless nautical-inspired staple.",
    sizes: SIZES_APPAREL,
    image: "/products/tees/tee_08.jpg",
    featured: true,
  },
  {
    id: "tee-09",
    slug: "dusty-blue-crew-tee",
    name: "Dusty Blue Crew Tee",
    category: "tees",
    price: 849,
    description:
      "A dusty slate-blue tee in soft washed cotton, a relaxed everyday shade that pairs with everything.",
    sizes: SIZES_APPAREL,
    image: "/products/tees/tee_09.jpg",
  },
  {
    id: "tee-10",
    slug: "steel-blue-crew-tee",
    name: "Steel Blue Crew Tee",
    category: "tees",
    price: 849,
    description:
      "A soft steel-blue crew tee in lightweight cotton, an easy-wearing shade for warm days.",
    sizes: SIZES_APPAREL,
    image: "/products/tees/tee_10.jpg",
  },

  // Pants
  {
    id: "pant-01",
    slug: "slim-fit-chinos",
    name: "Slim Fit Chinos",
    category: "pants",
    price: 2399,
    description:
      "Stretch-cotton chinos cut for a slim, modern fit without sacrificing comfort through the day.",
    sizes: SIZES_PANTS,
    image: "/products/pants/pant_01.jpg",
    featured: true,
  },
  {
    id: "pant-02",
    slug: "navy-slim-chinos",
    name: "Navy Slim Chinos",
    category: "pants",
    price: 2399,
    description:
      "Sharp navy chinos with a tailored slim fit, equally suited to the office or a night out.",
    sizes: SIZES_PANTS,
    image: "/products/pants/pant_02.jpg",
  },
  {
    id: "pant-03",
    slug: "grey-tailored-trousers",
    name: "Grey Tailored Trousers",
    category: "pants",
    price: 2599,
    description:
      "Smart light-grey tailored trousers with a clean crease, dressy enough for smart-casual settings.",
    sizes: SIZES_PANTS,
    image: "/products/pants/pant_03.jpg",
  },
  {
    id: "pant-04",
    slug: "dark-wash-slim-jeans",
    name: "Dark Wash Slim Jeans",
    category: "pants",
    price: 2899,
    description:
      "Dark-wash slim jeans with subtle whiskering, a versatile denim that dresses up or down easily.",
    sizes: SIZES_PANTS,
    image: "/products/pants/pant_04.jpg",
  },
  {
    id: "pant-05",
    slug: "light-wash-straight-jeans",
    name: "Light Wash Straight Jeans",
    category: "pants",
    price: 2799,
    description:
      "Light-wash straight jeans with a broken-in feel, an easy warm-weather denim staple.",
    sizes: SIZES_PANTS,
    image: "/products/pants/pant_05.jpg",
  },
  {
    id: "pant-06",
    slug: "olive-cargo-trousers",
    name: "Olive Cargo Trousers",
    category: "pants",
    price: 2699,
    description:
      "Utility-inspired olive cargo trousers with side pockets, built for durability and everyday movement.",
    sizes: SIZES_PANTS,
    image: "/products/pants/pant_06.jpg",
  },
  {
    id: "pant-07",
    slug: "khaki-cargo-trousers",
    name: "Khaki Cargo Trousers",
    category: "pants",
    price: 2699,
    description:
      "Classic khaki cargo trousers with roomy side pockets, a rugged everyday layer for outdoor days.",
    sizes: SIZES_PANTS,
    image: "/products/pants/pant_07.jpg",
  },
  {
    id: "pant-08",
    slug: "stone-tailored-chinos",
    name: "Stone Tailored Chinos",
    category: "pants",
    price: 2499,
    description:
      "Light stone-colored chinos with a tapered leg, a warm-weather staple for smart-casual dressing.",
    sizes: SIZES_PANTS,
    image: "/products/pants/pant_08.jpg",
  },
  {
    id: "pant-09",
    slug: "black-wash-slim-jeans",
    name: "Black Wash Slim Jeans",
    category: "pants",
    price: 2899,
    description:
      "Faded black-wash slim jeans with a lived-in look, an edgier alternative to classic blue denim.",
    sizes: SIZES_PANTS,
    image: "/products/pants/pant_09.jpg",
    featured: true,
  },
  {
    id: "pant-10",
    slug: "charcoal-slim-jeans",
    name: "Charcoal Slim Jeans",
    category: "pants",
    price: 2899,
    description:
      "Charcoal-wash slim jeans with a tapered ankle, a versatile denim that works with almost anything.",
    sizes: SIZES_PANTS,
    image: "/products/pants/pant_10.jpg",
  },

  // Accessories
  {
    id: "accessory-01",
    slug: "classic-baseball-cap-black",
    name: "Classic Baseball Cap — Black",
    category: "accessories",
    price: 599,
    description:
      "A washed cotton dad cap with a curved brim and adjustable strap, a simple finish for any outfit.",
    sizes: SIZES_ONE,
    image: "/products/accessories/accessory_01_cap_black.jpg",
    featured: true,
  },
  {
    id: "accessory-02",
    slug: "classic-baseball-cap-beige",
    name: "Classic Baseball Cap — Beige",
    category: "accessories",
    price: 599,
    description:
      "A washed cotton dad cap in a soft beige tone with a curved brim and adjustable strap.",
    sizes: SIZES_ONE,
    image: "/products/accessories/accessory_02_cap_beige.jpg",
  },
  {
    id: "accessory-03",
    slug: "classic-baseball-cap-navy",
    name: "Classic Baseball Cap — Navy",
    category: "accessories",
    price: 599,
    description:
      "A washed cotton dad cap in navy with a curved brim and adjustable strap for an easy everyday fit.",
    sizes: SIZES_ONE,
    image: "/products/accessories/accessory_03_cap_navy.jpg",
  },
  {
    id: "accessory-04",
    slug: "classic-baseball-cap-white",
    name: "Classic Baseball Cap — White",
    category: "accessories",
    price: 599,
    description:
      "A washed cotton dad cap in crisp white with a curved brim and adjustable strap.",
    sizes: SIZES_ONE,
    image: "/products/accessories/accessory_04_cap_white.jpg",
  },
  {
    id: "accessory-05",
    slug: "cotton-bucket-hat",
    name: "Cotton Bucket Hat",
    category: "accessories",
    price: 799,
    description:
      "A structured cotton bucket hat with a wide brim, built for sun cover with a laid-back look.",
    sizes: SIZES_ONE,
    image: "/products/accessories/accessory_05_bucket_hat.jpg",
  },
  {
    id: "accessory-06",
    slug: "leather-belt-black",
    name: "Leather Belt — Black",
    category: "accessories",
    price: 1299,
    description:
      "A full-grain black leather belt with a brushed silver buckle, cut to trim for a precise fit.",
    sizes: SIZES_BELT,
    image: "/products/accessories/accessory_06_belt_black.jpg",
    featured: true,
  },
  {
    id: "accessory-07",
    slug: "leather-belt-brown",
    name: "Leather Belt — Brown",
    category: "accessories",
    price: 1299,
    description:
      "A full-grain brown leather belt with a brushed silver buckle, a versatile everyday essential.",
    sizes: SIZES_BELT,
    image: "/products/accessories/accessory_07_belt_brown.jpg",
  },
  {
    id: "accessory-08",
    slug: "leather-belt-dark-brown",
    name: "Leather Belt — Dark Brown",
    category: "accessories",
    price: 1299,
    description:
      "A full-grain dark brown leather belt with a brushed silver buckle, built to age well with wear.",
    sizes: SIZES_BELT,
    image: "/products/accessories/accessory_08_belt_darkbrown.jpg",
  },
  {
    id: "accessory-09",
    slug: "silver-curb-chain",
    name: "Silver Curb Chain",
    category: "accessories",
    price: 1999,
    description:
      "A bold stainless steel curb chain with a polished silver finish, a sharp everyday layering piece.",
    sizes: SIZES_ONE,
    image: "/products/accessories/accessory_09_chain_silver.jpg",
  },
  {
    id: "accessory-10",
    slug: "gold-curb-chain",
    name: "Gold Curb Chain",
    category: "accessories",
    price: 2499,
    description:
      "A bold gold-tone curb chain with a polished finish, a statement piece for layering or wearing solo.",
    sizes: SIZES_ONE,
    image: "/products/accessories/accessory_10_chain_gold.jpg",
  },
];

export function getProductBySlug(slug: string): SeedProduct | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getProductsByCategory(category?: Category): SeedProduct[] {
  if (!category) return PRODUCTS;
  return PRODUCTS.filter((p) => p.category === category);
}

export function getFeaturedProducts(): SeedProduct[] {
  return PRODUCTS.filter((p) => p.featured);
}
