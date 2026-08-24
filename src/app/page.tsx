import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  getCategories,
  getFeaturedProducts,
  getProductBySlug,
  getStoreSettings,
} from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { LandingIntro } from "@/components/landing-intro";
import CircularGallery from "@/components/circular-gallery";

export const revalidate = 60;

/**
 * Editorial imagery for the category tiles. Keyed by category slug and keyed
 * deliberately in code, not the database: these are hand-picked shots, not
 * catalog data. A category with no entry here still renders — see the fallback
 * in the tile below.
 */
const CATEGORY_PREVIEWS: Record<
  string,
  { image: string; description: string }
> = {
  shirts: {
    image: "/products/shirts/shirt_01.jpg",
    description: "Oxfords, flannels & more",
  },
  pants: {
    image: "/products/pants/pant_01.jpg",
    description: "Chinos, jeans & trousers",
  },
  tees: {
    image: "/products/tees/tee_01.jpg",
    description: "Everyday crew tees",
  },
  accessories: {
    image: "/products/accessories/accessory_06_belt_black.jpg",
    description: "Caps, belts & chains",
  },
};

const ONE_PER_CATEGORY_SLUGS = [
  "navy-stripe-poplin-shirt",
  "black-wash-slim-jeans",
  "breton-stripe-tee",
  "gold-curb-chain",
];

export default async function Home() {
  const [featured, CATEGORIES, settings, picks] = await Promise.all([
    getFeaturedProducts(),
    getCategories(),
    getStoreSettings(),
    Promise.all(ONE_PER_CATEGORY_SLUGS.map((slug) => getProductBySlug(slug))),
  ]);

  // Keep the existing STORE shape so the markup below is untouched.
  const STORE = {
    name: settings.name,
    tagline: settings.tagline,
    address: settings.address,
    phoneHref: settings.phone_href,
    phoneDisplay: settings.phone_display,
  };

  const oneOfEach = picks.filter(
    (product): product is NonNullable<typeof product> => Boolean(product)
  );
  const galleryItems = oneOfEach.map((product) => ({
    image: product.image,
    text: product.name,
  }));

  return (
    <LandingIntro title={STORE.name}>
      <div className="flex flex-col">
      {/* Hero */}
      <section className="relative isolate flex min-h-[560px] items-center overflow-hidden text-white sm:min-h-[640px] lg:min-h-[760px]">
        <Image
          src="/hero/model.jpg"
          alt="Model wearing Teenage Menswear denim jacket and sunglasses"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[50%_18%]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />

        <div className="relative mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 py-20 sm:px-6">
          <span className="inline-flex w-fit items-center rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
            NEW SEASON ARRIVALS
          </span>
          <h1 className="max-w-xl text-4xl font-bold tracking-tight sm:text-6xl">
            {STORE.name}
          </h1>
          <p className="max-w-md text-lg text-zinc-200">
            {STORE.tagline} Shirts, pants, tees, and accessories built for
            everyday wear.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              href="/products"
              className="flex h-12 items-center justify-center rounded-full bg-accent px-6 font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Shop Collection
            </Link>
            <Link
              href="#categories"
              className="flex h-12 items-center justify-center rounded-full border border-white/25 px-6 font-medium text-white transition-colors hover:bg-white/10"
            >
              Explore Categories
            </Link>
          </div>
        </div>
      </section>

      {/* Quality */}
      <section className="border-b border-black/10 bg-white dark:border-white/10 dark:bg-black">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
            <span className="text-xs font-semibold tracking-wide text-accent">
              WHY OUR FITS FEEL DIFFERENT
            </span>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Fabric worth bragging about.
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400">
              Every piece is cut from premium combed cotton, breathable linen
              blends, and heavyweight denim — stitched to hold its shape and
              its color, wash after wash. We don&apos;t just sell clothes, we
              sell fabric you can feel the difference in.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-6 text-center sm:grid-cols-3 sm:text-left">
            <FeatureItem
              icon={<CheckIcon />}
              title="Premium fabrics"
              description="Combed cotton, linen blends & heavyweight denim."
            />
            <FeatureItem
              icon={<CheckIcon />}
              title="Reinforced stitching"
              description="Built to survive everyday wear and repeat washes."
            />
            <FeatureItem
              icon={<CheckIcon />}
              title="Fits for every body"
              description="Sizes from S to XXL, waist 30 to 38."
            />
          </div>
        </div>
      </section>

      {/* One from each rack */}
      <section className="border-b border-black/10 bg-zinc-950 py-16 text-white dark:border-white/10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-wide text-accent">
              THIS SEASON&apos;S EDIT
            </span>
            <h2 className="text-2xl font-semibold tracking-tight">
              One to watch from every rack
            </h2>
            <p className="text-zinc-400">
              Drag, scroll, or use the arrow keys to explore a standout pick
              from each category.
            </p>
          </div>
        </div>
        <div style={{ height: 420, position: "relative" }}>
          <CircularGallery
            items={galleryItems}
            bend={2}
            textColor="#ffffff"
            borderRadius={0.06}
            scrollEase={0.03}
            font="700 22px Arial, Helvetica, sans-serif"
          />
        </div>
      </section>

      {/* Shop by category */}
      <section id="categories" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            Shop by category
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400">
            Everything you need, organized simply.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {CATEGORIES.map((category) => {
            // A category added in the database won't have editorial imagery, so
            // fall back rather than crashing on an undefined preview.
            const preview = CATEGORY_PREVIEWS[category.value] ?? {
              image: oneOfEach[0]?.image ?? "/hero/model.jpg",
              description: `Shop ${category.label.toLowerCase()}`,
            };
            return (
              <Link
                key={category.value}
                href={`/products?category=${category.value}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-black/10 transition-shadow hover:shadow-lg dark:border-white/10"
              >
                <ProductImage
                  image={preview.image}
                  name={category.label}
                  className="aspect-square w-full transition-transform group-hover:scale-[1.03]"
                  sizes="(min-width: 640px) 25vw, 50vw"
                />
                <div className="flex flex-col gap-0.5 p-4">
                  <h3 className="font-semibold">{category.label}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {preview.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured products */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            Featured picks
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400">
            A few of our most-loved essentials.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Visit us */}
      <section className="border-t border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-950">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-2 sm:px-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              Visit us in-store
            </h2>
            <p className="max-w-sm text-zinc-500 dark:text-zinc-400">
              Prefer to see it in person? Drop by our store — we&apos;re
              happy to help you find the right fit.
            </p>
            <div className="flex items-start gap-3 pt-2">
              <PinIcon />
              <span className="text-sm">{STORE.address}</span>
            </div>
            <div className="flex items-center gap-3">
              <PhoneIcon />
              <a href={STORE.phoneHref} className="text-sm hover:underline">
                {STORE.phoneDisplay}
              </a>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-1 rounded-xl border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-black">
            <span className="text-xs font-semibold tracking-wide text-accent">
              STORE ADDRESS
            </span>
            <span className="mt-2 text-lg font-semibold">{STORE.name}</span>
            <span className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {STORE.address}
            </span>
            <a
              href={STORE.phoneHref}
              className="mt-4 text-sm font-medium text-accent hover:underline"
            >
              Call {STORE.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
      </div>
    </LandingIntro>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start">
      <span className="text-accent">{icon}</span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 5-5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-6 w-6 flex-shrink-0"
      aria-hidden="true"
    >
      <path
        d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-6 w-6 flex-shrink-0"
      aria-hidden="true"
    >
      <path
        d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v3a2 2 0 0 1-2 2c-8 0-14-6-14-14a2 2 0 0 1 2-2z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
