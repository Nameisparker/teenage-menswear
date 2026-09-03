import { describe, expect, it } from "vitest";
import {
  DEFAULT_SORT,
  applyProductQuery,
  availableSizes,
  compareSizes,
  hasActiveFilters,
  parseProductQuery,
} from "./product-filters";
import type { Product } from "./types";

/** A product with only the fields the filters look at. */
function product(overrides: Partial<Product> & { name: string }): Product {
  return {
    id: overrides.name,
    slug: overrides.name.toLowerCase().replace(/\s+/g, "-"),
    category: "shirts",
    price: 1000,
    discountPercent: 0,
    offerPrice: 1000,
    description: "",
    sizes: ["M"],
    stockBySize: { M: 5 },
    image: "/products/x.jpg",
    images: ["/products/x.jpg"],
    ...overrides,
  };
}

describe("parseProductQuery", () => {
  it("falls back to the default sort for junk", () => {
    expect(parseProductQuery({ sort: "cheapest" }).sort).toBe(DEFAULT_SORT);
    expect(parseProductQuery({}).sort).toBe(DEFAULT_SORT);
  });

  it("accepts repeated params and comma lists, uppercased and deduped", () => {
    expect(parseProductQuery({ size: ["m", "L"] }).sizes).toEqual(["M", "L"]);
    expect(parseProductQuery({ size: "m,l ,M" }).sizes).toEqual(["M", "L"]);
  });

  it("treats a bad price as no filter rather than an empty grid", () => {
    const query = parseProductQuery({ min: "abc", max: "-5" });
    expect(query.minPrice).toBeUndefined();
    expect(query.maxPrice).toBeUndefined();
  });

  it("reads only sale=1 as on sale", () => {
    expect(parseProductQuery({ sale: "1" }).onSale).toBe(true);
    expect(parseProductQuery({ sale: "true" }).onSale).toBe(false);
  });

  it("does not count the default sort as an active filter", () => {
    expect(hasActiveFilters(parseProductQuery({}))).toBe(false);
    expect(hasActiveFilters(parseProductQuery({ sort: "price-asc" }))).toBe(false);
    expect(hasActiveFilters(parseProductQuery({ size: "M" }))).toBe(true);
  });
});

describe("compareSizes", () => {
  it("puts letter sizes in rack order, not alphabetical", () => {
    expect(["XL", "S", "M", "XS"].sort(compareSizes)).toEqual([
      "XS",
      "S",
      "M",
      "XL",
    ]);
  });

  it("sorts waist sizes numerically", () => {
    expect(["36", "30", "34"].sort(compareSizes)).toEqual(["30", "34", "36"]);
  });

  it("keeps letter sizes ahead of anything it does not recognise", () => {
    expect(["One Size", "M"].sort(compareSizes)).toEqual(["M", "One Size"]);
  });
});

describe("availableSizes", () => {
  it("dedupes case-insensitively but keeps the original casing", () => {
    const sizes = availableSizes([
      product({ name: "A", sizes: ["M", "one size"] }),
      product({ name: "B", sizes: ["m", "One Size"] }),
    ]);
    expect(sizes).toEqual(["M", "one size"]);
  });
});

describe("applyProductQuery", () => {
  const catalog = [
    product({ name: "Cheap Tee", price: 500, offerPrice: 500 }),
    product({
      name: "Discounted Shirt",
      price: 2000,
      offerPrice: 1400,
      discountPercent: 30,
    }),
    product({ name: "Featured Jeans", offerPrice: 1000, featured: true }),
    product({ name: "Big Shirt", price: 3000, offerPrice: 3000, sizes: ["XXL"] }),
  ];

  it("never mutates the input array", () => {
    const order = catalog.map((p) => p.name);
    applyProductQuery(catalog, parseProductQuery({ sort: "price-desc" }));
    expect(catalog.map((p) => p.name)).toEqual(order);
  });

  it("puts featured first, then alphabetical", () => {
    const names = applyProductQuery(catalog, parseProductQuery({})).map(
      (p) => p.name
    );
    expect(names[0]).toBe("Featured Jeans");
    expect(names.slice(1)).toEqual(["Big Shirt", "Cheap Tee", "Discounted Shirt"]);
  });

  it("sorts on what the customer pays, not the struck-through price", () => {
    const names = applyProductQuery(
      catalog,
      parseProductQuery({ sort: "price-asc" })
    ).map((p) => p.name);
    // Discounted Shirt lists at 2000 but is charged 1400, so it comes before
    // Big Shirt at 3000 and after Featured Jeans at 1000.
    expect(names).toEqual([
      "Cheap Tee",
      "Featured Jeans",
      "Discounted Shirt",
      "Big Shirt",
    ]);
  });

  it("filters on the offer price at the boundaries, inclusively", () => {
    const inRange = applyProductQuery(
      catalog,
      parseProductQuery({ min: "1000", max: "1400" })
    ).map((p) => p.name);
    expect(inRange).toEqual(["Featured Jeans", "Discounted Shirt"]);
  });

  it("keeps only discounted products when on sale", () => {
    const onSale = applyProductQuery(catalog, parseProductQuery({ sale: "1" }));
    expect(onSale.map((p) => p.name)).toEqual(["Discounted Shirt"]);
  });

  it("matches a product that stocks any requested size", () => {
    const matched = applyProductQuery(
      catalog,
      parseProductQuery({ size: "xxl,m" })
    );
    expect(matched).toHaveLength(4);
    expect(
      applyProductQuery(catalog, parseProductQuery({ size: "XXL" })).map(
        (p) => p.name
      )
    ).toEqual(["Big Shirt"]);
  });
});
