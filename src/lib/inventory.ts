/**
 * Inventory arithmetic for the admin dashboard.
 *
 * Pure on purpose: the queries live in admin-catalog.ts, the counting lives
 * here. That keeps the rules deciding "sold out" and "running low" in one
 * testable place, and it is the same LOW_STOCK the storefront uses to say
 * "Only 2 left" — a dashboard calling something low while the product page did
 * not would be worse than no dashboard.
 */
import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "./supabase/database.types";

/** At or below this many units left, a size is worth flagging. */
export const LOW_STOCK = 5;

/** One product_variants row, joined to the product it belongs to. */
export type VariantInput = {
  productId: string;
  productName: string;
  slug: string;
  categorySlug: string;
  isActive: boolean;
  size: string;
  sortOrder: number;
  stock: number;
};

/** One order_items row, with the status of the order it belongs to. */
export type SoldInput = {
  productId: string | null;
  size: string;
  quantity: number;
  orderStatus: OrderStatus;
};

export type SizeLine = {
  size: string;
  stock: number;
  /** Units that left the shelf and stayed gone — cancelled orders excluded. */
  sold: number;
};

export type InventoryProduct = {
  productId: string;
  name: string;
  slug: string;
  categorySlug: string;
  isActive: boolean;
  sizes: SizeLine[];
  stock: number;
  sold: number;
  /** Every size at zero. A product with no sizes at all is not "sold out". */
  soldOut: boolean;
  sizesOut: number;
  sizesLow: number;
};

export type InventorySummary = {
  products: number;
  hiddenProducts: number;
  soldOutProducts: number;
  unitsInStock: number;
  unitsSold: number;
  sizesOut: number;
  sizesLow: number;
};

/**
 * Cancelling an order puts its units back (see restore_stock_on_cancel), so
 * counting them as sold would count the same shirt twice: once on the shelf
 * and once in the sales figure.
 */
function countsAsSold(status: OrderStatus): boolean {
  return status !== "cancelled";
}

export function buildInventory(
  variants: VariantInput[],
  sold: SoldInput[]
): InventoryProduct[] {
  const soldByKey = new Map<string, number>();
  for (const line of sold) {
    if (!line.productId || !countsAsSold(line.orderStatus)) continue;
    const key = `${line.productId} ${line.size}`;
    soldByKey.set(key, (soldByKey.get(key) ?? 0) + line.quantity);
  }

  const byProduct = new Map<string, InventoryProduct>();

  for (const variant of [...variants].sort(
    (a, b) => a.sortOrder - b.sortOrder
  )) {
    let product = byProduct.get(variant.productId);
    if (!product) {
      product = {
        productId: variant.productId,
        name: variant.productName,
        slug: variant.slug,
        categorySlug: variant.categorySlug,
        isActive: variant.isActive,
        sizes: [],
        stock: 0,
        sold: 0,
        soldOut: false,
        sizesOut: 0,
        sizesLow: 0,
      };
      byProduct.set(variant.productId, product);
    }

    const soldForSize =
      soldByKey.get(`${variant.productId} ${variant.size}`) ?? 0;

    product.sizes.push({
      size: variant.size,
      stock: variant.stock,
      sold: soldForSize,
    });
    product.stock += variant.stock;
    product.sold += soldForSize;
    if (variant.stock === 0) product.sizesOut += 1;
    else if (variant.stock <= LOW_STOCK) product.sizesLow += 1;
  }

  for (const product of byProduct.values()) {
    product.soldOut =
      product.sizes.length > 0 && product.sizes.every((s) => s.stock === 0);
  }

  // Emptiest first: a dashboard is a list of things to act on, and a product
  // with nothing left is the most urgent of them. Name breaks ties so the order
  // does not wander between requests.
  return [...byProduct.values()].sort(
    (a, b) => a.stock - b.stock || a.name.localeCompare(b.name)
  );
}

export function summariseInventory(
  products: InventoryProduct[]
): InventorySummary {
  return products.reduce<InventorySummary>(
    (summary, product) => ({
      products: summary.products + 1,
      hiddenProducts: summary.hiddenProducts + (product.isActive ? 0 : 1),
      soldOutProducts: summary.soldOutProducts + (product.soldOut ? 1 : 0),
      unitsInStock: summary.unitsInStock + product.stock,
      unitsSold: summary.unitsSold + product.sold,
      sizesOut: summary.sizesOut + product.sizesOut,
      sizesLow: summary.sizesLow + product.sizesLow,
    }),
    {
      products: 0,
      hiddenProducts: 0,
      soldOutProducts: 0,
      unitsInStock: 0,
      unitsSold: 0,
      sizesOut: 0,
      sizesLow: 0,
    }
  );
}

/** Every size at or below the low mark, worst first — the restock list. */
export function restockList(
  products: InventoryProduct[]
): { product: InventoryProduct; line: SizeLine }[] {
  return products
    .flatMap((product) =>
      product.sizes
        .filter((line) => line.stock <= LOW_STOCK)
        .map((line) => ({ product, line }))
    )
    .sort(
      (a, b) =>
        a.line.stock - b.line.stock ||
        a.product.name.localeCompare(b.product.name)
    );
}

export type OrderInput = {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  total: number;
  itemCount: number;
};

export type OrderSummary = {
  orders: number;
  awaitingDispatch: number;
  cancelled: number;
  unitsOrdered: number;
  /** Money actually received. Unpaid COD is not revenue yet. */
  paidRevenue: number;
  /** Placed but not paid for, COD included — what is still owed. */
  outstanding: number;
  failedPayments: number;
  codOrders: number;
  prepaidOrders: number;
};

export function summariseOrders(orders: OrderInput[]): OrderSummary {
  return orders.reduce<OrderSummary>(
    (summary, order) => {
      const open = order.status === "pending" || order.status === "confirmed";
      const paid = order.paymentStatus === "paid";
      const live = order.status !== "cancelled";

      return {
        orders: summary.orders + 1,
        awaitingDispatch: summary.awaitingDispatch + (open ? 1 : 0),
        cancelled: summary.cancelled + (order.status === "cancelled" ? 1 : 0),
        unitsOrdered: summary.unitsOrdered + (live ? order.itemCount : 0),
        paidRevenue: summary.paidRevenue + (paid ? order.total : 0),
        outstanding: summary.outstanding + (live && !paid ? order.total : 0),
        failedPayments:
          summary.failedPayments + (order.paymentStatus === "failed" ? 1 : 0),
        codOrders: summary.codOrders + (order.paymentMethod === "cod" ? 1 : 0),
        prepaidOrders:
          summary.prepaidOrders + (order.paymentMethod === "razorpay" ? 1 : 0),
      };
    },
    {
      orders: 0,
      awaitingDispatch: 0,
      cancelled: 0,
      unitsOrdered: 0,
      paidRevenue: 0,
      outstanding: 0,
      failedPayments: 0,
      codOrders: 0,
      prepaidOrders: 0,
    }
  );
}
