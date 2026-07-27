import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: `Air's Gallery Challenge`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/*
          Every thumbnail comes from this one origin, and the first request for
          it cannot start until React has hydrated and measured the container.
          Warming DNS, TCP, and TLS during that window takes the handshake off
          the critical path for the LCP image. No crossOrigin: the images are
          plain <img> requests, and a mismatched attribute opens a second,
          unused connection.
        */}
        <link rel="preconnect" href="https://air-prod.imgix.net" />
        <link rel="dns-prefetch" href="https://air-prod.imgix.net" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
