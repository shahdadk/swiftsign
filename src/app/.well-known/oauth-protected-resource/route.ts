import {
  protectedResourceHandler,
  metadataCorsOptionsRequestHandler,
} from 'mcp-handler'
import { env } from '@/lib/env'

// RFC 9728 protected-resource metadata: tells MCP clients which authorization
// server protects /mcp (ourselves). withMcpAuth's 401 WWW-Authenticate header
// already points here.

const handler = protectedResourceHandler({
  authServerUrls: [env.NEXT_PUBLIC_APP_URL],
})

export { handler as GET }
export const OPTIONS = metadataCorsOptionsRequestHandler()
