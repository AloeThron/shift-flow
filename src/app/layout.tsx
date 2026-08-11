import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";

import { AuthProvider } from "@/components/providers/auth-provider";

import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Shift-Flow",
  description: "ระบบจัดตารางเวรห้องปฏิบัติการแบบ config-driven",
};

/** layout หลัก — UI ภาษาไทยเป็นหลัก */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${notoSansThai.variable} font-sans`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
