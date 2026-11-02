import type { Metadata } from "next";
import "./globals.css";
import BannerCookies from "@/components/BannerCookies";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: "Evaluaciones UUB",
  description: "Plataforma de evaluaciones académicas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('uub_theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
        <ThemeProvider>
          {children}
          <BannerCookies />
        </ThemeProvider>
      </body>
    </html>
  );
}
