import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JUALBELIRAKET.COM",
  description: "The trusted marketplace for used sports equipment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${oswald.variable} font-sans antialiased bg-background text-foreground`}
      >
        <Navbar />
        {children}
        <footer className="border-t border-slate-200 bg-white/90 mt-10">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 text-xs text-slate-500 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <p>
              JUALBELIRAKET.COM berkomitmen memproses data pribadi sesuai
              UU No. 27 Tahun 2022 tentang Perlindungan Data Pribadi (PDP).
            </p>
            <div className="flex items-center gap-3">
              <Link href="/privacy" className="text-brand-primary hover:underline">Kebijakan Privasi</Link>
              <Link href="/terms" className="text-brand-primary hover:underline">Syarat & Ketentuan</Link>
              <a href="mailto:privacy@jualbeliraket.com" className="text-brand-primary hover:underline">privacy@jualbeliraket.com</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
