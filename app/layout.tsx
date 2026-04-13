import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./mobile-desktop-overrides.css";
import "./mobile-nav-layer-fix.css";
import { AuthSessionGuard } from "@/components/AuthSessionGuard";
import { PublicAppChrome } from "@/components/PublicAppChrome";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "安感島｜安靜共工與陪伴型數位空間",
  description: "安感島提供低壓力專注共工與陪伴型數位空間。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased cc-shell`}>
        <AuthSessionGuard />
        <PublicAppChrome>{children}</PublicAppChrome>
      </body>
    </html>
  );
}
