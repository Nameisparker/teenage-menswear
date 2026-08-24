import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/cart-context";
import { getCategories, getStoreSettings } from "@/lib/catalog";
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
  return {
    title: `${store.name} — ${categoryList}`,
    description: `${store.name} — ${store.tagline} ${categoryList}. ${store.address}.`,
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
