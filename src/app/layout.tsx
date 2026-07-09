import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { getSessionUser } from "@/core/identity/session";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "SeaSharp — The Global Trade Infrastructure Platform",
  description:
    "One platform. Every trade. Anywhere in the world. Trade intelligence, documentation, RFQ marketplace, logistics, and trade finance in one connected ecosystem.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-cream-50 text-ink-900 antialiased`}
      >
        <Navbar user={user} />
        {children}
      </body>
    </html>
  );
}
