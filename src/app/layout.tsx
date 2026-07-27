import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: `Air's Gallery Challenge`,
  description:
    "A justified, virtualized gallery of a public Air board: 761 assets and its sub-boards, with marquee selection, drag to reorder, and drag into a board.",
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
        {/*
          The asset list is fetched from here as soon as the client hydrates,
          and it is a different origin from the image CDN, so it needs its own
          handshake warmed.
        */}
        <link rel="preconnect" href="https://api.air.inc" />
        <link rel="dns-prefetch" href="https://api.air.inc" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
