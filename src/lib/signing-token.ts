import crypto from 'crypto'

// CSPRNG single-use signing token + expiry. Replaces the predictable cuid()
// default that used to back Recipient.signingToken — the sole credential
// binding a human to a legal signature must be unguessable.
export function newSigningToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export const DEFAULT_TOKEN_TTL_DAYS = 30

export function tokenExpiry(days = DEFAULT_TOKEN_TTL_DAYS): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

export function isTokenExpired(expiresAt: Date | null | undefined): boolean {
  return !!expiresAt && expiresAt.getTime() < Date.now()
}
