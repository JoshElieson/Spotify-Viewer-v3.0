import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SocialFooter } from "@/components/SocialFooter";
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
  title: "Spotify Profile Stats",
  description: "View your Spotify profile, top artists, tracks, recent plays, and playlists.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#121212] font-sans text-zinc-100">
        {children}
        <SocialFooter />
      </body>
    </html>
  );
}
