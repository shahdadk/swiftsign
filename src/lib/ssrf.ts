import { lookup } from 'dns/promises'
import net from 'net'
import ipaddr from 'ipaddr.js'
import { env } from './env'

// SSRF guard for outbound requests to user-supplied URLs (webhook endpoints).
// Blocks loopback / private / link-local / ULA / CGNAT / metadata ranges,
// requires https in production, and restricts ports. We resolve the hostname
// and validate EVERY resolved address, then re-validate immediately before each
// delivery so a record that was public at creation can't quietly point inward
// later. (Note: a sub-TTL DNS-rebind flip between this check and connect is a
// known residual; mitigated by validating right before each fetch.)

export class SsrfError extends Error {
  constructor(public reason: string) {
    super(`ssrf-blocked: ${reason}`)
    this.name = 'SsrfError'
  }
}

// Only globally-routable unicast addresses are allowed. ipaddr.js classifies
// everything else (loopback, private, linkLocal, uniqueLocal, reserved,
// carrierGradeNat, broadcast, unspecified) into named ranges.
export function isPublicAddress(ip: string): boolean {
  let addr: ipaddr.IPv4 | ipaddr.IPv6
  try {
    addr = ipaddr.parse(ip)
  } catch {
    return false
  }
  if (addr.kind() === 'ipv6') {
    const v6 = addr as ipaddr.IPv6
    if (v6.isIPv4MappedAddress()) {
      return v6.toIPv4Address().range() === 'unicast'
    }
  }
  return addr.range() === 'unicast'
}

function allowedPorts(): number[] {
  return env.NODE_ENV === 'production' ? [443] : [80, 443, 3000]
}

export async function assertPublicUrl(rawUrl: string): Promise<void> {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    throw new SsrfError('invalid-url')
  }
  if (u.username || u.password) throw new SsrfError('userinfo-not-allowed')
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new SsrfError('protocol-not-allowed')
  }
  if (env.NODE_ENV === 'production' && u.protocol !== 'https:') {
    throw new SsrfError('https-required')
  }
  const port = u.port ? parseInt(u.port, 10) : u.protocol === 'https:' ? 443 : 80
  if (!allowedPorts().includes(port)) throw new SsrfError('port-not-allowed')

  const host = u.hostname
  if (net.isIP(host)) {
    if (!isPublicAddress(host)) throw new SsrfError('private-address')
    return
  }
  let results: { address: string }[]
  try {
    results = await lookup(host, { all: true })
  } catch {
    throw new SsrfError('dns-resolution-failed')
  }
  if (results.length === 0) throw new SsrfError('dns-no-result')
  for (const r of results) {
    if (!isPublicAddress(r.address)) throw new SsrfError('private-address')
  }
}

// Non-throwing variant for validate-at-create-time UIs.
export async function isPublicUrl(rawUrl: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await assertPublicUrl(rawUrl)
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err instanceof SsrfError ? err.reason : 'invalid-url' }
  }
}
