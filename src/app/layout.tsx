import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Productivier — Sistem Realisasi & Proyek Tim",
  description: "Pencatatan realisasi harian, progres proyek otomatis, dan monitoring tim.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jakarta.variable} ${jetbrains.variable}`}>
      <body className="antialiased bg-[#FAF9F6] text-[#111827] selection:bg-[#0F766E]/15 selection:text-[#0F766E]">
        {children}
      </body>
    </html>
  );
}
