/**
 * A category slug. Categories live in the database now, so this cannot be a
 * closed union — the set is only known at runtime. Validate against the
 * fetched category list rather than relying on the compiler.
 */
export type Category = string;

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: Category;
  price: number; // rupees
  description: string;
  sizes: string[];
  image: string; // path under /public
  featured?: boolean;
};

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number;
  size: string;
  image: string;
  quantity: number;
};
