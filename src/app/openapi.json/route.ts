import { getOpenApiDocument } from '@/lib/openapi/registry'

// Public OpenAPI 3.1 document. No auth — it describes the API, it doesn't expose
// data. Generated once per process and served from module scope so repeat hits
// are cheap; clients/CDN can cache it for an hour.
export const runtime = 'nodejs'

const document = getOpenApiDocument()

export function GET() {
  return new Response(JSON.stringify(document), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
