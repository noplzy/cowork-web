import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  description: "安感島是一個為孤獨經濟使用者設計的數位避風港，提供低壓力共工、陪伴式搭子與可持續使用的專注空間。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased cc-shell`}>
        {children}
      </body>
    </html>
  );
}
