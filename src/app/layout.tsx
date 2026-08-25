import { Suspense } from "react";
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/cart-context";
import { NewOrdersProvider } from "@/context/new-orders-context";
import { getCategories, getStoreSettings } from "@/lib/catalog";
import { SITE_URL } from "@/lib/site";
import { AuthProvider } from "@/context/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { PendingCartAdd } from "@/components/pending-cart-add";
import { Header } from "@/components/header";
import { AuthErrorBanner } from "@/components/auth-error-banner";
import { Footer } from "@/components/footer";

/**
 * Poppins is not a variable font on Google Fonts, so the weights have to be
 * named. These four are the ones the app actually uses — 400 for body copy,
 * 500 for font-medium, 600 for font-semibold, 700 for font-bold. Adding more
 * would download files nothing renders.
 */
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});


export async function generateMetadata(): Promise<Metadata> {
  const [store, categories] = await Promise.all([
    getStoreSettings(),
    getCategories(),
  ]);
  const categoryList = categories.map((c) => c.label).join(", ");
  const description = `${store.name} — ${store.tagline} ${categoryList}. ${store.address}.`;

  return {
    // Makes every relative URL in per-page metadata resolve to an absolute
    // one, which Open Graph and Twitter cards require.
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${store.name} — ${categoryList}`,
      // Page titles read "Breton Stripe Tee — Teenage Menswear".
      template: `%s — ${store.name}`,
    },
    description,
    openGraph: {
      type: "website",
      siteName: store.name,
      title: `${store.name} — ${categoryList}`,
      description,
      url: SITE_URL,
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Fetched here so the client-side Header can render category links.
  const [categories, store] = await Promise.all([
    getCategories(),
    getStoreSettings(),
  ]);

  return (
    <html
      lang="en"
      className={`${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <CartProvider>
            {/* Inside AuthProvider because it subscribes only for admins, and
                outside Header because the bell lives in it. */}
            <NewOrdersProvider>
              <Header categories={categories} storeName={store.name} />
              {/* Suspense is required, not cosmetic: the banner reads search
                  params, and every prerendered route below would fail to build
                  without a boundary here. */}
              <Suspense fallback={null}>
                <AuthErrorBanner />
              </Suspense>
              <main className="flex-1">{children}</main>
              <Footer />
              <AuthModal />
              <PendingCartAdd />
            </NewOrdersProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
