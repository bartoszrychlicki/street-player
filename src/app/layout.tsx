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
  title: "Street Player - Explore and Capture Your City",
  description: "Track your walking and cycling adventures by capturing grid squares on a map. Import GPX files, compete with friends, and explore every street in your city.",
  keywords: ["street mapping", "GPX tracker", "city explorer", "walking tracker", "cycling tracker", "map game"],
  authors: [{ name: "Street Player" }],
  openGraph: {
    title: "Street Player - Explore and Capture Your City",
    description: "Track your walking and cycling adventures by capturing grid squares on a map.",
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
