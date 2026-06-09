import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { registerSwiftSignTools } from '../../../mcp/src/tools'
import { authenticateApiKey } from '@/lib/auth'
import { env } from '@/lib/env'

// Hosted MCP endpoint: `claude mcp add --transport http swiftsign
// https://swiftsign.ca/mcp --header "Authorization: Bearer sk_..."`.
// Same tool module as the stdio binary (mcp/src/tools.ts); only the key
// resolution differs — here it rides in per request via withMcpAuth, so
// signup is stdio-only and downloads return base64 (read-only filesystem).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const handler = createMcpHandler(
  (server) => {
    // Two @modelcontextprotocol/sdk copies are in play (root 1.26 for
    // mcp-handler, mcp/ workspace 1.28 for the stdio build). The runtime
    // surface registerSwiftSignTools uses is identical; bridge the nominal
    // type mismatch at this one boundary.
    registerSwiftSignTools(server as unknown as Parameters<typeof registerSwiftSignTools>[0], {
      apiUrl: env.NEXT_PUBLIC_APP_URL,
      resolveKey: (extra) => extra?.authInfo?.token,
      allowFileWrites: false,
      allowSignup: false,
    })
  },
  { serverInfo: { name: 'swiftsign', version: '0.5.1' } },
  { basePath: '', verboseLogs: false, maxDuration: 300 }
)

const authedHandler = withMcpAuth(
  handler,
  async (req, bearer) => {
    if (!bearer) return undefined
    const auth = await authenticateApiKey(req)
    if (!auth) return undefined
    return {
      token: bearer,
      scopes: auth.apiKey.scopes,
      clientId: auth.user.id,
      extra: { userId: auth.user.id, livemode: auth.livemode },
    }
  },
  { required: true }
)

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE }
