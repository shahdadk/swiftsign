import type { MetadataRoute } from "next";

// Private, tokened, or machine-only surfaces. Everything else is crawlable.
const DISALLOW = ["/dashboard", "/sign", "/embed", "/api"];

// AI crawlers we explicitly welcome, by name. A wildcard allow already covers
// them, but a named rule survives any future tightening of the `*` group and
// reads as an explicit invitation.
const NAMED_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Bingbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
      ...NAMED_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: DISALLOW,
      })),
    ],
    sitemap: "https://swiftsign.ca/sitemap.xml",
  };
}
