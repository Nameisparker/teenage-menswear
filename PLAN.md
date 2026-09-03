# Roadmap

Working document. Ticked items are done and deployed; everything else is a
proposal with enough detail to start from. Ordered by what unblocks the shop,
not by what is most interesting to build.

The three at the top are the ones that separate "a demo someone runs for you"
from "a shop that runs itself".

---

## 1. Product images without a deploy — DONE

**Why.** `product-form.tsx` takes `imagePath` as a *text input* and there is not
one `storage.from(...)` call in the repo: images live in `public/products/`, so
adding a product means committing a file and redeploying. Nobody can run this
store without a developer on hand.

- [x] `product-images` Storage bucket, public read, admin-only write via `is_admin()`
- [x] `productImageSrc()` resolves storage keys, absolute URLs and legacy `/public` paths
- [x] `next.config.ts` remote pattern for the Supabase storage host
- [x] Upload control in the product form: preview, validation, progress, manual override
- [x] Delete the replaced object when an image is swapped, but only when no
      other product row still points at it
- [x] **Gallery:** `product_images` table, `ProductGallery` on the PDP, and a
      gallery editor on the admin product page. `products.image_path` stays the
      cover — it is what cards, the cart and the order snapshot read
- [ ] Reordering the gallery. Order is upload order today; it needs drag, or at
      least up/down, to be worth building

## 2. Stock that actually exists — DONE

**Why.** `product_variants.stock` was selected in `catalog.ts` and read nowhere
else. Nothing decremented it. Two customers could buy the last shirt, no size
was ever greyed out, and "only 2 left" was impossible.

- [x] Decrement inside `place_order`, in the same transaction as the insert,
      with the variant rows locked `for update` and ordered by id so two carts
      queue instead of deadlocking
- [x] `P0003` with a customer-worded message naming the product, size and count;
      `checkoutError()` shows it through instead of replacing it
- [x] Stock restored by the `orders_restore_stock_on_cancel` trigger
- [x] Sold-out sizes disabled and struck through, "Only N left" under the chips,
      and the add button refuses to put more in the cart than exist
- [x] Stock totals column in `/admin/products`, per-size editor on the product
      page. The editor is on the edit page rather than inline in the list:
      restocking is a one-number change and should not mean re-submitting a
      whole product form
- [x] **Auto-cancel stale unpaid prepaid orders.** Stock is held from the moment
      an order exists, so an abandoned Razorpay payment holds it indefinitely.
      A `pg_cron` job cancelling unpaid `razorpay` orders older than ~30 minutes
      returns it through the trigger that already exists
- [x] Warn on the cart page when a line now exceeds stock, rather than letting
      checkout be the first to say so
## 3. Tell the customer what happened — DONE, one transport

**Why.** The bell notified the admin. The customer got nothing at all — no
confirmation, no "shipped".

- [x] `_shared/notify.ts`: composes the messages, delivers them, never throws
- [x] `notify-order` Edge Function, called by the checkout page (COD placed) and
      by `setOrderStatus` (status changed). Not a DB webhook: that needs the
      function URL and a service-role key baked into a trigger definition, which
      means a secret in a migration file for no gain
- [x] Prepaid confirmations sent inline from `razorpay-verify` and
      `razorpay-webhook`, where the money actually arrives
- [x] Email via Resend, and a log transport when no key is set — so the wiring
      is exercised and visible before anyone signs up for anything
- [ ] **WhatsApp.** The channel that matters most here. Goes in `deliver()`
      beside the email branch; nothing above that function is channel-specific
- [ ] Set `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` and `SITE_URL` to switch it from
      logging to sending. Until then every message is a log line
---

## Next

| # | Feature | Notes |
|---|---|---|
| 4 | Verified-purchase reviews | The reviews policy never checks `order_items`, so any signed-in stranger can rate any product. Trust feature and spam control in one |
| 5 | Refunds | `payment_status = 'refunded'` exists and nothing writes it. Admin button → Razorpay refund API from an Edge Function |
| 6 | Product search | Category + size + sort only today. `pg_trgm` or full-text on name/description, plus a header search box |
| 7 | JSON-LD structured data | `sitemap.ts`, `robots.ts`, prices and ratings all exist. `Product` + `Offer` + `AggregateRating` on the PDP buys star ratings in Google results |
| 8 | Coupon codes | Discounts are per-product only. Cart-level promos and free-shipping thresholds are how launches run |
| 9 | Shipping charges | `total` has no shipping component. Even if shipping stays free, decide the column now — retrofitting touches `place_order`, cart, checkout and every price display |
| 10 | Customer-initiated cancel | `src/lib/orders.ts` is read-only, so every change of mind becomes a phone call |
| 11 | Courier AWB + tracking link | Status is manual and "Shipped" carries no tracking number |
| 12 | Abandoned-cart nudge | `cart_items` already persists server-side; `pg_cron` + the function from #3 |
| 13 | Wishlist | One table plus RLS. Also the foundation for back-in-stock alerts once #2 lands |
| 14 | Returns / exchange request | Apparel in India assumes it. Customer-initiated, admin-approved, reusing the `order_events` timeline |
| 15 | Admin analytics | **Done** — `/admin` is now a dashboard: stock and sold units per size, restock list, order and revenue tiles. Next: revenue by day, top products |
| 16 | PWA manifest | No `manifest.ts`, no icons |
| 17 | Invoice / GST receipt | Print-friendly order page with GSTIN, needed once registered |

## Engineering hygiene

- [x] GitHub Action on push and PR: `next typegen`, `tsc --noEmit`, `eslint`,
      `vitest run`. No secrets, so it runs on forks and on a clean checkout
- [x] Unit tests for `pricing.ts`, `product-filters.ts`, `images.ts` and
      `phone.ts` — 35 assertions over the logic that decides prices, order and
      validity. The pricing suite is a contract with the `offer_price` generated
      column: change one, change the other
- [ ] **`next build` in CI.** Left out because the catalog read throws rather
      than rendering an empty storefront when Supabase is unreachable, so a
      build needs real credentials. Add it with a repo secret pointing at a
      throwaway project
- [ ] **Playwright happy path** (add to cart → checkout → paid → order visible).
      Same blocker plus a seeded signed-in user, so it needs its own project and
      an admin login in secrets
- [ ] Error monitoring (Sentry). A failed payment currently tells the customer
      something and tells us nothing
- [x] Ran Supabase `get_advisors`. Fixed: `rls_auto_enable()` had EXECUTE
      granted to anon/authenticated (and was missing from the migration history
      entirely — see 20260903060658), and `product_reviews.user_id` had no
      covering index. Left as-is on purpose: `is_admin()` executable by
      authenticated, and the multiple-permissive-policy warnings on
      products/product_variants/product_images — both are documented decisions
- [ ] Enable leaked-password protection in Auth → Providers → Password.
      Dashboard toggle, no code
