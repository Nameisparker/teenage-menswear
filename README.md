This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Database (Supabase)

The schema lives in `supabase/migrations/`, applied in filename order:

| Migration | Contents |
| --- | --- |
| `20260824000000_init_schema.sql` | Tables, indexes, enum, and RLS policies |
| `20260824000001_seed_catalog.sql` | 4 categories, 40 products, 169 size variants, store settings |
| `20260824000002_auth_profile_trigger.sql` | Optional: auto-creates a profile on signup |

### Tables

| Table | Purpose | Access under RLS |
| --- | --- | --- |
| `categories` | Category slugs and labels | Public read |
| `products` | Catalog, `is_active` for soft delete | Public read where active |
| `product_variants` | One row per size, with per-size `stock` | Public read |
| `store_settings` | Store name, address, phone (single row) | Public read |
| `profiles` | Mirror of `auth.users`, filled by a signup trigger | Own row only |
| `addresses` | Saved shipping addresses | Own rows only |
| `cart_items` | Server-side cart, so it follows the customer | Own rows only |
| `orders` | Placed orders, shipping details snapshotted | Insert + read own; no update |
| `order_items` | Line items, name/price snapshotted at purchase | Insert + read own |

Design notes worth knowing before you extend it:

- **RLS is on for every table.** A table with RLS on and no matching policy denies
  everything, so each one grants exactly what it needs. Catalog writes have no
  policy at all — seeding and admin edits go through the SQL editor or the
  `service_role` key, never the browser.
- **Customers cannot update or delete orders.** Otherwise a shopper could rewrite
  a total or mark their own order delivered. Status changes belong to admin
  tooling running as `service_role`.
- **Orders snapshot everything.** Shipping details and line-item name/price/image
  are copied onto the order rather than joined, so later catalog edits or a
  deleted address never rewrite order history.
- **Money is whole rupees** (integer), matching `formatPrice`. If fractional
  pricing is ever needed, migrate to paise — never to a float.

### Applying it

**Paste one file at a time**, in filename order, and check for an error before
moving on. The SQL Editor runs a pasted batch as a single transaction, so one
rejected statement silently rolls back everything in that paste — which looks
identical to "nothing happened".

The third file is optional and expected to fail on some projects: creating a
trigger on `auth.users` needs ownership of that table. If it errors with
`must be owner of relation users`, skip it — the app upserts its own profile row
on sign-in, and `profiles` has an insert policy for exactly that.

Or use the CLI, which applies each migration in its own transaction:

```bash
supabase link --project-ref etcoozatxtprnigjuzuk
supabase db push
```

Then confirm what actually landed:

```bash
npm run check:db
```

It reads with the anon key, so it verifies what the browser will really see:
expected row counts on the catalog, and that RLS blocks anon from customer data.

The seed is idempotent — every insert upserts on its natural key, so re-running
is safe and updates existing rows.

### Changing the catalog

`supabase/migrations/20260824000001_seed_catalog.sql` is generated, not
hand-written. Edit `src/lib/products.ts`, then:

```bash
npm run seed:sql
```

That keeps the SQL from drifting from the data the app ships with.

## Authentication (Supabase)

Adding an item to the cart requires a signed-in shopper. Sign-in is either a
mobile number + SMS OTP, or Google. Both run through Supabase Auth.

The storefront still renders without credentials — the sign-in dialog just shows
a setup notice instead of working buttons.

### 1. Credentials

Copy `.env.example` to `.env.local` and fill in both values from your Supabase
dashboard under **Project Settings > API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

Restart `npm run dev` afterwards — `NEXT_PUBLIC_*` values are inlined at build
time. Only ever use the **anon** key here; the `service_role` key must never
reach the browser.

### 2. Phone OTP

Supabase does not send SMS itself, so this needs a provider:

1. **Authentication > Sign In / Providers > Phone** — enable it.
2. Under **SMS Provider**, connect Twilio, MessageBird, Vonage or Textlocal and
   save their credentials.
3. India is `+91`, the default dial code in the sign-in dialog. Numbers are sent
   to Supabase in E.164 (`+919384626894`).

To develop without paying for SMS, add test numbers under **Phone > Test OTP** —
each maps a number to a fixed code that verifies without a real text.

### 3. Google

1. In Google Cloud, create an **OAuth 2.0 Client ID** (Web application) and set
   the authorised redirect URI to
   `https://<project-ref>.supabase.co/auth/v1/callback`.
2. **Authentication > Sign In / Providers > Google** — enable it and paste the
   client ID and secret.
3. **Authentication > URL Configuration** — add the app's callback to
   **Redirect URLs**: `http://localhost:3000/auth/callback` for local work, plus
   the deployed equivalent. Set **Site URL** to the production origin.

### Checking your setup

Both providers must be switched on in the dashboard before either button works —
the app code needs no changes. To see what is live:

```bash
npm run check:auth
```

It prints `READY` / `MISSING` per provider with a deep link to the page that
fixes it, and exits non-zero while anything is missing.

### How it fits together

| File | Role |
| --- | --- |
| `src/proxy.ts` | Refreshes the session on every request (Next.js 16 renamed `middleware` to `proxy`) |
| `src/lib/supabase/client.ts` | Browser client, one per tab |
| `src/lib/supabase/server.ts` | Per-request client for Server Components and Route Handlers |
| `src/context/auth-context.tsx` | Session state, OTP / Google / sign-out actions, modal state |
| `src/components/auth-modal.tsx` | The sign-in dialog |
| `src/app/auth/callback/route.ts` | Exchanges the Google PKCE code for a session |
| `src/lib/pending-cart.ts` | Remembers the blocked item across the Google redirect |
| `src/components/pending-cart-add.tsx` | Adds that item once sign-in succeeds |

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
