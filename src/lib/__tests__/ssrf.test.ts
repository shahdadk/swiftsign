import { describe, it, expect } from 'vitest'
import { isPublicAddress } from '@/lib/ssrf'

// isPublicAddress is the pure core of the SSRF guard: it decides whether a
// literal IP is globally-routable unicast. assertPublicUrl's DNS path needs
// network and is intentionally not tested here.

describe('isPublicAddress', () => {
  it('rejects private / reserved / metadata IPv4 ranges', () => {
    expect(isPublicAddress('127.0.0.1')).toBe(false) // loopback
    expect(isPublicAddress('10.0.0.5')).toBe(false) // private
    expect(isPublicAddress('192.168.1.1')).toBe(false) // private
    expect(isPublicAddress('169.254.169.254')).toBe(false) // link-local / cloud metadata
    expect(isPublicAddress('100.64.0.1')).toBe(false) // CGNAT
    expect(isPublicAddress('0.0.0.0')).toBe(false) // unspecified
  })

  it('rejects private / loopback IPv6 ranges', () => {
    expect(isPublicAddress('::1')).toBe(false) // loopback
    expect(isPublicAddress('fc00::1')).toBe(false) // unique-local (ULA)
  })

  it('rejects an IPv4-mapped IPv6 of a private address', () => {
    expect(isPublicAddress('::ffff:10.0.0.5')).toBe(false)
    expect(isPublicAddress('::ffff:127.0.0.1')).toBe(false)
  })

  it('accepts public IPv4 addresses', () => {
    expect(isPublicAddress('8.8.8.8')).toBe(true)
    expect(isPublicAddress('1.1.1.1')).toBe(true)
  })

  it('accepts a public IPv6 address', () => {
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true) // Cloudflare DNS
  })

  it('rejects garbage input', () => {
    expect(isPublicAddress('not-an-ip')).toBe(false)
    expect(isPublicAddress('')).toBe(false)
  })
})
