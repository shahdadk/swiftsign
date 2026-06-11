import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Dancing_Script,
  Caveat,
  Great_Vibes,
  Homemade_Apple,
} from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Handwriting fonts for the typed-signature styles in the signer flow.
// preload:false keeps them off the critical path; they fetch lazily when the
// signature modal references the CSS variables.
const dancingScript = Dancing_Script({
  variable: "--font-sig-dancing",
  subsets: ["latin"],
  weight: "600",
  preload: false,
});

const caveat = Caveat({
  variable: "--font-sig-caveat",
  subsets: ["latin"],
  weight: "600",
  preload: false,
});

const greatVibes = Great_Vibes({
  variable: "--font-sig-vibes",
  subsets: ["latin"],
  weight: "400",
  preload: false,
});

const homemadeApple = Homemade_Apple({
  variable: "--font-sig-apple",
  subsets: ["latin"],
  weight: "400",
  preload: false,
});

export const metadata: Metadata = {
  title: "SwiftSign — AI-native signatures",
  description:
    "Send, track, and seal contracts from your terminal. No drag handles. No per-seat fees.",
};

// Structured data: Organization + SoftwareApplication with both offers
// (free sandbox, $15/mo Pro). Server-rendered so crawlers see it in the
// initial HTML. Shapes follow schema.org; URLs are absolute.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://swiftsign.ca/#organization",
      name: "SwiftSign",
      url: "https://swiftsign.ca",
      sameAs: [
        "https://github.com/shahdadk/swiftsign",
        "https://www.npmjs.com/package/swiftsign-mcp",
        "https://pypi.org/project/swiftsign/",
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://swiftsign.ca/#software",
      name: "SwiftSign",
      url: "https://swiftsign.ca",
      description:
        "E-signature API and MCP server for AI coding tools. Send, track, and seal documents from code or an agent, with sealed PDFs and a Certificate of Completion.",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      publisher: { "@id": "https://swiftsign.ca/#organization" },
      offers: [
        {
          "@type": "Offer",
          name: "Sandbox",
          description:
            "Free forever. Unlimited watermarked test envelopes with an instant sandbox API key.",
          price: "0",
          priceCurrency: "USD",
          url: "https://swiftsign.ca/pricing",
        },
        {
          "@type": "Offer",
          name: "Pro",
          description: "$15 per month, flat, per workspace. Live sealed sends.",
          price: "15.00",
          priceCurrency: "USD",
          url: "https://swiftsign.ca/pricing",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "15.00",
            priceCurrency: "USD",
            unitText: "MONTH",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${dancingScript.variable} ${caveat.variable} ${greatVibes.variable} ${homemadeApple.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
      </body>
    </html>
  );
}
