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
  price: number; // rupees, before any discount
  /** Percent off, 0 when the product is not on offer. */
  discountPercent: number;
  /** What the customer pays. Equals price when discountPercent is 0. */
  offerPrice: number;
  description: string;
  sizes: string[];
  /**
   * Units left, by size. Filled by catalog.ts from product_variants; a size
   * missing from the map is a size that cannot be bought.
   */
  stockBySize: Record<string, number>;
  image: string; // path under /public
  /**
   * The gallery in display order, cover first. Only the product page fetches
   * the extra angles, so elsewhere this is just [image].
   */
  images: string[];
  featured?: boolean;
};

export type Review = {
  id: string;
  productId: string;
  userId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  /** List price. Line totals charge offerPrice — see totalPrice in CartProvider. */
  price: number;
  discountPercent: number;
  offerPrice: number;
  size: string;
  image: string;
  quantity: number;
  /**
   * Units available of this size right now. Fetched with the cart so a line
   * that has outgrown its stock can say so before checkout does.
   */
  stock: number;
};
