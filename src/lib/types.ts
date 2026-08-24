export type Category = "shirts" | "pants" | "tees" | "accessories";

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
