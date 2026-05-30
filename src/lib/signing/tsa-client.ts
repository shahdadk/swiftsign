/**
 * RFC-3161 Time-Stamp Authority (TSA) client.
 *
 * Builds a TimeStampReq over a SHA-256 message digest, POSTs it to the
 * configured TSA, validates the response, and returns the DER-encoded
 * TimeStampToken (the `ContentInfo` from the response) ready to be spliced into
 * a CMS SignerInfo as an `id-aa-timeStampToken` unsigned attribute.
 *
 * NODE runtime (uses global fetch + AbortController, both available in Node 22).
 */
import * as asn1js from 'asn1js'
import {
  TimeStampReq,
  TimeStampResp,
  MessageImprint,
  AlgorithmIdentifier,
} from 'pkijs'
import { env } from '@/lib/env'

const SHA256_OID = '2.16.840.1.101.3.4.2.1'
const REQUEST_CONTENT_TYPE = 'application/timestamp-query'
const REPLY_ACCEPT = 'application/timestamp-reply'
const TIMEOUT_MS = 8000

/** PKIStatus values that count as a successfully issued timestamp. */
const GRANTED = 0
const GRANTED_WITH_MODS = 1

export class TsaError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'TsaError'
  }
}

/** Copy a Buffer into a fresh (non-shared) ArrayBuffer for asn1js. */
function toArrayBuffer(buf: Buffer): ArrayBuffer {
  const out = new ArrayBuffer(buf.byteLength)
  new Uint8Array(out).set(buf)
  return out
}

/** Build the DER bytes of a TimeStampReq for the given SHA-256 digest. */
function buildRequest(messageDigest: Buffer): ArrayBuffer {
  const nonce = new Uint8Array(16)
  globalThis.crypto.getRandomValues(nonce)

  const tspReq = new TimeStampReq({
    version: 1,
    messageImprint: new MessageImprint({
      hashAlgorithm: new AlgorithmIdentifier({ algorithmId: SHA256_OID }),
      hashedMessage: new asn1js.OctetString({
        valueHex: toArrayBuffer(messageDigest),
      }),
    }),
    // Large random nonce so we can confirm response freshness.
    nonce: new asn1js.Integer({ valueHex: nonce.buffer }),
    certReq: true,
  })

  return tspReq.toSchema().toBER(false)
}

/** POST a DER request to one TSA URL and return the DER TimeStampToken. */
async function requestOne(url: string, reqDer: ArrayBuffer): Promise<Buffer> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': REQUEST_CONTENT_TYPE,
        Accept: REPLY_ACCEPT,
      },
      body: Buffer.from(reqDer),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new TsaError(`TSA ${url} returned HTTP ${res.status}`)
  }

  const respDer = Buffer.from(await res.arrayBuffer())
  const asn1 = asn1js.fromBER(toArrayBuffer(respDer))
  if (asn1.offset === -1) {
    throw new TsaError(`TSA ${url} returned an unparseable TimeStampResp`)
  }

  const tspResp = new TimeStampResp({ schema: asn1.result })
  const status = tspResp.status.status
  if (status !== GRANTED && status !== GRANTED_WITH_MODS) {
    throw new TsaError(`TSA ${url} PKIStatus not granted (status=${status})`)
  }

  if (!tspResp.timeStampToken) {
    throw new TsaError(`TSA ${url} granted but returned no timeStampToken`)
  }

  // The timeStampToken is a ContentInfo; encode it back to DER as the token to
  // embed into the CMS unsigned attribute.
  const tokenDer = tspResp.timeStampToken.toSchema().toBER(false)
  return Buffer.from(tokenDer)
}

/**
 * Get an RFC-3161 TimeStampToken (DER ContentInfo) over a SHA-256 messageDigest.
 * Tries TSA_URL, then retries once against TSA_URL_FALLBACK on any failure.
 * Throws TsaError if both fail.
 */
export async function getTimestampToken(messageDigest: Buffer): Promise<Buffer> {
  const reqDer = buildRequest(messageDigest)

  try {
    return await requestOne(env.TSA_URL, reqDer)
  } catch (primaryErr) {
    try {
      return await requestOne(env.TSA_URL_FALLBACK, reqDer)
    } catch (fallbackErr) {
      throw new TsaError(
        `Both TSAs failed (primary=${env.TSA_URL}, fallback=${env.TSA_URL_FALLBACK})`,
        { primaryErr, fallbackErr }
      )
    }
  }
}
