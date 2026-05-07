import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./mobile-desktop-overrides.css";
import "./mobile-nav-layer-fix.css";
import "./image20-dom.css";
import { AuthSessionGuard } from "@/components/AuthSessionGuard";
import { Image20AiCompanion } from "@/components/image20/Image20Ai";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "安感島 Calm&Co",
  description: "低壓力同行、安靜陪伴與可信任的數位在場空間。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthSessionGuard />
        {children}
        <Image20AiCompanion />
      </body>
    </html>
  );
}
