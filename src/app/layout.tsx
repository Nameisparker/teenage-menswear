import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/cart-context";
import { getCategories, getStoreSettings } from "@/lib/catalog";
import { SITE_URL } from "@/lib/site";
import { AuthProvider } from "@/context/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { PendingCartAdd } from "@/components/pending-cart-add";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <CartProvider>
            <Header categories={categories} storeName={store.name} />
            <main className="flex-1">{children}</main>
            <Footer />
            <AuthModal />
            <PendingCartAdd />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
