import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Street Player - Eksploruj i Zdobywaj Swoje Miasto",
  description: "Śledź swoje piesze i rowerowe przygody, zdobywając kwadraty na mapie. Importuj pliki GPX, rywalizuj ze znajomymi i odkrywaj każdą ulicę w swoim mieście.",
  keywords: ["mapowanie ulic", "tracker GPX", "eksplorator miasta", "tracker spacerów", "tracker rowerowy", "gra mapowa"],
  authors: [{ name: "Street Player" }],
  openGraph: {
    title: "Street Player - Eksploruj i Zdobywaj Swoje Miasto",
    description: "Śledź swoje piesze i rowerowe przygody, zdobywając kwadraty na mapie.",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
