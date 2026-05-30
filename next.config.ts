import type { NextConfig } from 'next'

// Shared CSP directives. The default policy forbids framing entirely
// (frame-ancestors 'none' via X-Frame-Options: DENY). The signer + embedded
// signing routes need to be embeddable in third-party pages, so they override
// the framing directives below.
const baseCspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.r2.cloudflarestorage.com",
  "connect-src 'self' blob: https://api.stripe.com https://*.sentry.io https://*.upstash.io",
  "frame-src https://js.stripe.com https://checkout.stripe.com https://billing.stripe.com",
  "form-action 'self' https://checkout.stripe.com",
  "base-uri 'self'",
  "object-src 'none'",
]

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Content-Security-Policy',
    value: baseCspDirectives.join('; '),
  },
]

// Framing-allowed overrides for the signer + embed routes. Header overriding
// in Next is last-match-wins per key, so these run AFTER `securityHeaders` for
// the same path and replace the framing-related headers only:
//   - drop X-Frame-Options: DENY (set to a value modern browsers ignore for
//     framing; CSP frame-ancestors governs and takes precedence per CSP L2)
//   - add `frame-ancestors *` to the CSP so any origin may embed the page
const embedSecurityHeaders = [
  { key: 'X-Frame-Options', value: 'ALLOWALL' },
  {
    key: 'Content-Security-Policy',
    value: [...baseCspDirectives, 'frame-ancestors *'].join('; '),
  },
]

const nextConfig: NextConfig = {
  // pdfjs-dist + @napi-rs/canvas use native binaries and a worker file inside
  // node_modules. Bundling them with Turbopack breaks worker resolution and
  // strips the native .node binary at runtime — keep them external.
  serverExternalPackages: [
    'pdfjs-dist',
    '@napi-rs/canvas',
    'canvas',
    'pdf-lib',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // Framing-allowed overrides — must come AFTER the global block so the
      // last-match-wins override applies for these paths only.
      {
        source: '/embed/:token*',
        headers: embedSecurityHeaders,
      },
      {
        source: '/sign/:token*',
        headers: embedSecurityHeaders,
      },
    ]
  },
}

export default nextConfig
