import { describe, expect, it } from "vitest";
import {
  LOW_STOCK,
  buildInventory,
  restockList,
  summariseInventory,
  summariseOrders,
  type SoldInput,
  type VariantInput,
} from "./inventory";

function variant(overrides: Partial<VariantInput> & { size: string }): VariantInput {
  return {
    productId: "p1",
    productName: "Poplin Shirt",
    slug: "poplin-shirt",
    categorySlug: "shirts",
    isActive: true,
    sortOrder: 0,
    stock: 10,
    ...overrides,
  };
}

function sold(overrides: Partial<SoldInput> & { size: string }): SoldInput {
  return {
    productId: "p1",
    quantity: 1,
    orderStatus: "pending",
    ...overrides,
  };
}

describe("buildInventory", () => {
  it("keeps sizes in the order the product offers them", () => {
    const [product] = buildInventory(
      [
        variant({ size: "L", sortOrder: 2 }),
        variant({ size: "S", sortOrder: 0 }),
        variant({ size: "M", sortOrder: 1 }),
      ],
      []
    );
    expect(product.sizes.map((s) => s.size)).toEqual(["S", "M", "L"]);
  });

  it("attributes sold units to the right size", () => {
    const [product] = buildInventory(
      [variant({ size: "S" }), variant({ size: "M", sortOrder: 1 })],
      [sold({ size: "M", quantity: 3 }), sold({ size: "M", quantity: 2 })]
    );
    expect(product.sizes).toEqual([
      { size: "S", stock: 10, sold: 0 },
      { size: "M", stock: 10, sold: 5 },
    ]);
    expect(product.sold).toBe(5);
  });

  it("does not count a cancelled order as sold", () => {
    // Cancelling returns the units, so counting them would count the same
    // shirt twice — once on the shelf and once in the sales figure.
    const [product] = buildInventory(
      [variant({ size: "M" })],
      [
        sold({ size: "M", quantity: 4, orderStatus: "cancelled" }),
        sold({ size: "M", quantity: 1, orderStatus: "delivered" }),
      ]
    );
    expect(product.sold).toBe(1);
  });

  it("ignores a line whose product has been deleted", () => {
    const [product] = buildInventory(
      [variant({ size: "M" })],
      [sold({ size: "M", quantity: 9, productId: null })]
    );
    expect(product.sold).toBe(0);
  });

  it("is sold out only when every size is at zero", () => {
    const [partly] = buildInventory(
      [variant({ size: "S", stock: 0 }), variant({ size: "M", stock: 2 })],
      []
    );
    expect(partly.soldOut).toBe(false);
    expect(partly.sizesOut).toBe(1);

    const [gone] = buildInventory(
      [variant({ size: "S", stock: 0 }), variant({ size: "M", stock: 0 })],
      []
    );
    expect(gone.soldOut).toBe(true);
    expect(gone.sizesOut).toBe(2);
  });

  it("counts a size at the low mark as low, and zero as out rather than low", () => {
    const [product] = buildInventory(
      [
        variant({ size: "S", stock: 0 }),
        variant({ size: "M", stock: LOW_STOCK }),
        variant({ size: "L", stock: LOW_STOCK + 1 }),
      ],
      []
    );
    expect(product.sizesOut).toBe(1);
    expect(product.sizesLow).toBe(1);
  });

  it("puts the emptiest product first", () => {
    const products = buildInventory(
      [
        variant({ productId: "a", productName: "Full", stock: 20, size: "M" }),
        variant({ productId: "b", productName: "Empty", stock: 0, size: "M" }),
      ],
      []
    );
    expect(products.map((p) => p.name)).toEqual(["Empty", "Full"]);
  });
});

describe("summariseInventory", () => {
  it("adds up the catalog", () => {
    const products = buildInventory(
      [
        variant({ size: "S", stock: 0 }),
        variant({ size: "M", stock: 3, sortOrder: 1 }),
        variant({
          productId: "p2",
          productName: "Hidden Tee",
          isActive: false,
          size: "M",
          stock: 0,
        }),
      ],
      [sold({ size: "M", quantity: 2 })]
    );

    expect(summariseInventory(products)).toEqual({
      products: 2,
      hiddenProducts: 1,
      soldOutProducts: 1,
      unitsInStock: 3,
      unitsSold: 2,
      sizesOut: 2,
      sizesLow: 1,
    });
  });
});

describe("restockList", () => {
  it("lists every low or empty size, emptiest first", () => {
    const products = buildInventory(
      [
        variant({ size: "S", stock: 2 }),
        variant({ size: "M", stock: 0, sortOrder: 1 }),
        variant({ size: "L", stock: 40, sortOrder: 2 }),
      ],
      []
    );

    expect(
      restockList(products).map((entry) => [entry.line.size, entry.line.stock])
    ).toEqual([
      ["M", 0],
      ["S", 2],
    ]);
  });
});

describe("summariseOrders", () => {
  const order = (
    overrides: Partial<Parameters<typeof summariseOrders>[0][number]> = {}
  ) => ({
    status: "pending" as const,
    paymentMethod: "cod" as const,
    paymentStatus: "unpaid" as const,
    total: 1000,
    itemCount: 2,
    ...overrides,
  });

  it("counts only received money as revenue", () => {
    const summary = summariseOrders([
      order({ paymentStatus: "paid", total: 1500 }),
      order({ total: 1000 }),
    ]);
    expect(summary.paidRevenue).toBe(1500);
    // An unpaid COD order is money still owed, not money taken.
    expect(summary.outstanding).toBe(1000);
  });

  it("excludes a cancelled order from units and outstanding", () => {
    const summary = summariseOrders([
      order({ status: "cancelled", total: 999, itemCount: 3 }),
      order({ itemCount: 1 }),
    ]);
    expect(summary.cancelled).toBe(1);
    expect(summary.unitsOrdered).toBe(1);
    expect(summary.outstanding).toBe(1000);
  });

  it("splits the payment methods and flags failures", () => {
    const summary = summariseOrders([
      order({ paymentMethod: "razorpay", paymentStatus: "failed" }),
      order({ paymentMethod: "razorpay", paymentStatus: "paid" }),
      order(),
    ]);
    expect(summary.prepaidOrders).toBe(2);
    expect(summary.codOrders).toBe(1);
    expect(summary.failedPayments).toBe(1);
  });

  it("counts pending and confirmed as awaiting dispatch", () => {
    const summary = summariseOrders([
      order({ status: "pending" }),
      order({ status: "confirmed" }),
      order({ status: "shipped" }),
      order({ status: "delivered" }),
    ]);
    expect(summary.awaitingDispatch).toBe(2);
  });
});
