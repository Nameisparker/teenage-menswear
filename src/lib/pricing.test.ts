import { describe, expect, it } from "vitest";
import { MAX_DISCOUNT_PERCENT, offerPriceFor } from "./pricing";

/**
 * These assertions are a contract with the database, not just with the
 * function: offerPriceFor mirrors the products.offer_price generated column in
 * 20260825000000_product_discounts.sql. If one of these ever has to change, the
 * migration has to change with it — the admin previews an offer price from this
 * code and the customer is charged from that column.
 */
describe("offerPriceFor", () => {
  it("leaves the price alone when there is no discount", () => {
    expect(offerPriceFor(1999, 0)).toBe(1999);
  });

  it("ignores a negative discount rather than raising the price", () => {
    expect(offerPriceFor(1999, -10)).toBe(1999);
  });

  it("rounds to whole rupees", () => {
    // 1999 * 0.85 = 1699.15
    expect(offerPriceFor(1999, 15)).toBe(1699);
    // 999 * 0.67 = 669.33
    expect(offerPriceFor(999, 33)).toBe(669);
  });

  it("rounds a genuine half up, as Postgres round(numeric) does", () => {
    // 1010 * 55 / 100 = 555.5 exactly. Postgres rounds halves away from zero
    // and Math.round rounds them up, so both land on 556.
    expect(offerPriceFor(1010, 45)).toBe(556);
  });

  it("never returns zero, so nothing is ever free by rounding", () => {
    expect(offerPriceFor(1, MAX_DISCOUNT_PERCENT)).toBe(1);
    expect(offerPriceFor(5, 90)).toBe(1);
  });

  it("caps out at the largest discount an admin can set", () => {
    expect(offerPriceFor(1000, MAX_DISCOUNT_PERCENT)).toBe(100);
  });
});
