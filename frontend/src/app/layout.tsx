import type { Metadata } from "next";
import "./globals.css";
import BannerCookies from "@/components/BannerCookies";

export const metadata: Metadata = {
  title: "Evaluaciones UUB",
  description: "Plataforma de evaluaciones académicas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        {children}
        <BannerCookies />
      </body>
    </html>
  );
}
