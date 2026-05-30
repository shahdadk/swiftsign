/**
 * Loads the PKCS#12 signing certificate for PAdES/CAdES document signing.
 *
 * NODE-ONLY: uses `fs`. Never import this from a client component.
 *
 * Resolution order:
 *   1. P12_CERT_BASE64  — base64 of the .p12 (prod injection)
 *   2. P12_CERT_PATH    — filesystem path to a .p12
 *   3. bundled fallback — certs/swiftsign.p12 resolved from process.cwd() (dev)
 *
 * The decoded buffer is cached at module scope so we only read disk / decode
 * base64 once per process.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { env } from '@/lib/env'

export interface SigningCert {
  p12Der: Buffer
  passphrase: string
  source: 'env' | 'file'
}

const BUNDLED_P12_PATH = 'certs/swiftsign.p12'
const DEFAULT_PASSPHRASE = 'swiftsign'

let cached: SigningCert | null = null

/**
 * Load (and cache) the signing certificate. Throws only if no source resolves
 * AND the bundled fallback is unreadable — which would mean a broken deploy.
 */
export function loadSigningCert(): SigningCert {
  if (cached) return cached

  const passphrase = env.P12_CERT_PASSWORD ?? DEFAULT_PASSPHRASE

  if (env.P12_CERT_BASE64) {
    cached = {
      p12Der: Buffer.from(env.P12_CERT_BASE64, 'base64'),
      passphrase,
      source: 'env',
    }
    return cached
  }

  if (env.P12_CERT_PATH) {
    cached = {
      p12Der: readFileSync(env.P12_CERT_PATH),
      passphrase,
      source: 'file',
    }
    return cached
  }

  // Bundled dev fallback. resolve() against cwd so this works regardless of the
  // route's compiled location.
  cached = {
    p12Der: readFileSync(resolve(process.cwd(), BUNDLED_P12_PATH)),
    passphrase,
    source: 'file',
  }
  return cached
}

/**
 * True when a signing cert can be resolved (env base64, env path, or the
 * bundled fallback exists). Cheap probe the seal pipeline can call before
 * attempting to sign.
 */
export function signingConfigured(): boolean {
  if (env.P12_CERT_BASE64 || env.P12_CERT_PATH) return true
  try {
    readFileSync(resolve(process.cwd(), BUNDLED_P12_PATH))
    return true
  } catch {
    return false
  }
}
