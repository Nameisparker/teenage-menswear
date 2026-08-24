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
