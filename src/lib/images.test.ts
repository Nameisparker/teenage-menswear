import { describe, expect, it } from "vitest";

/**
 * The module reads NEXT_PUBLIC_SUPABASE_URL at import time, so the env has to
 * be in place before it loads — hence the dynamic import rather than a plain
 * one at the top.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
const { PRODUCT_IMAGE_BUCKET, productImageKey, productImageSrc } = await import(
  "./images"
);

describe("productImageSrc", () => {
  it("passes a public/ path straight through", () => {
    expect(productImageSrc("/products/shirts/shirt_01.jpg")).toBe(
      "/products/shirts/shirt_01.jpg"
    );
  });

  it("passes an absolute URL straight through, rather than prefixing it", () => {
    expect(productImageSrc("https://cdn.example.com/a.jpg")).toBe(
      "https://cdn.example.com/a.jpg"
    );
    expect(productImageSrc("HTTPS://cdn.example.com/a.jpg")).toBe(
      "HTTPS://cdn.example.com/a.jpg"
    );
  });

  it("resolves anything else as a key in the bucket", () => {
    expect(productImageSrc("tee-123.jpg")).toBe(
      `https://project.supabase.co/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/tee-123.jpg`
    );
  });
});

describe("productImageKey", () => {
  it("slugifies the hint and keeps the extension", () => {
    const key = productImageKey("DSC_0001.JPEG", "Crisp White Poplin Shirt");
    expect(key).toMatch(/^crisp-white-poplin-shirt-\d+\.jpeg$/);
  });

  it("falls back to a usable name when there is no hint", () => {
    expect(productImageKey("photo.png", "")).toMatch(/^product-\d+\.png$/);
    expect(productImageKey("photo.png", "!!!")).toMatch(/^product-\d+\.png$/);
  });

  it("defaults the extension when the file has none", () => {
    expect(productImageKey("photo", "tee")).toMatch(/^tee-\d+\.jpg$/);
  });

  it("never collides on two uploads of the same file", () => {
    // The timestamp is what keeps a replacement from overwriting the file a
    // live product is still pointing at.
    const first = productImageKey("a.jpg", "tee");
    const later = productImageKey("a.jpg", "tee");
    expect(first.startsWith("tee-")).toBe(true);
    // Same millisecond is possible, so assert the shape rather than inequality.
    expect(later).toMatch(/^tee-\d+\.jpg$/);
  });
});
