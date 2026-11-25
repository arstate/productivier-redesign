import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import MotionProvider from "@/components/providers/MotionProvider";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Productivier — Smart Productivity & Team Dashboard",
  description: "Executive productivity dashboard, daily task realizations, project progress, and team monitoring.",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jakarta.variable} ${jetbrains.variable}`}>
      <body className="antialiased text-slate-900 selection:bg-[#D2F27C] selection:text-[#18181B] min-h-screen">
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10 pointer-events-none bg-dashboard-gradient"
        />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
