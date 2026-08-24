import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/cart-context";
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

export const metadata: Metadata = {
  title: "Teenage Menswear — Shirts, Pants, Tees & Accessories",
  description:
    "Teenage Menswear — everyday menswear essentials: shirts, pants, tees, and accessories. Kudankulam Road, Radhapuram, Tirunelveli.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <CartProvider>
            <Header />
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
