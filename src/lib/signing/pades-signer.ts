/**
 * PadesSigner — produces the detached PKCS#7 / CMS SignedData for a PDF
 * ByteRange, upgraded to CAdES-T by embedding an RFC-3161 timestamp token as an
 * `id-aa-timeStampToken` unsigned attribute on the SignerInfo.
 *
 * Flow:
 *   1. node-forge builds a DETACHED SignedData over the ByteRange bytes with
 *      SHA-256, the full cert chain, and signed attrs (contentType,
 *      messageDigest, signingTime). → CAdES-BES.
 *   2. We fetch a TSA token over SHA-256(signatureValue) and splice it as a
 *      [1] IMPLICIT unsignedAttrs SET onto the SignerInfo at the ASN.1 layer
 *      (node-forge has no unsigned-attr API). → CAdES-T.
 *   3. Resilience: if SIGNING_ENABLED is false or the TSA call throws, we keep
 *      the CAdES-BES PKCS#7 and continue (never throw on the timestamp path).
 *
 * `@signpdf/signpdf`'s SignPdf.sign() hands sign() the ByteRange-stripped PDF
 * buffer; we return the raw DER SignedData it embeds into /Contents.
 *
 * NODE-ONLY.
 */
import * as asn1js from 'asn1js'
import forge from 'node-forge'
import { Signer } from '@signpdf/utils'
import { createHash } from 'crypto'
import { loadSigningCert } from './cert-loader'
import { getTimestampToken } from './tsa-client'
import { env } from '@/lib/env'

export type SignatureProfile = 'CAdES-T' | 'CAdES-BES'

/** id-aa-timeStampToken (RFC 3161 / CAdES). */
const OID_TIMESTAMP_TOKEN = '1.2.840.113549.1.9.16.2.14'

interface LoadedCert {
  privateKey: forge.pki.rsa.PrivateKey
  certificate: forge.pki.Certificate
  chain: forge.pki.Certificate[]
}

/**
 * Insert a [1] IMPLICIT unsignedAttrs SET carrying the timestamp token onto the
 * single SignerInfo of a detached PKCS#7 ContentInfo.
 *
 * Walks: ContentInfo SEQ -> [0] EXPLICIT -> SignedData SEQ -> signerInfos SET
 * (last child) -> SignerInfo SEQ (last child) -> append [1] SET.
 */
export function embedTimestampToken(p7Der: Buffer, tsToken: Buffer): Buffer {
  const root = asn1js.fromBER(toArrayBuffer(p7Der))
  if (root.offset === -1 || !(root.result instanceof asn1js.Sequence)) {
    throw new Error('embedTimestampToken: PKCS#7 is not a SEQUENCE')
  }
  const contentInfo = root.result as asn1js.Sequence

  // ContentInfo ::= SEQUENCE { contentType OID, content [0] EXPLICIT ANY }
  const explicitContent = contentInfo.valueBlock.value[1]
  if (
    !(explicitContent instanceof asn1js.Constructed) ||
    explicitContent.valueBlock.value.length === 0
  ) {
    throw new Error('embedTimestampToken: missing content [0]')
  }
  const signedData = explicitContent.valueBlock.value[0]
  if (!(signedData instanceof asn1js.Sequence)) {
    throw new Error('embedTimestampToken: content is not a SignedData SEQUENCE')
  }

  // signerInfos is the last element of SignedData (a SET).
  const sdChildren = signedData.valueBlock.value
  const signerInfos = sdChildren[sdChildren.length - 1]
  if (!(signerInfos instanceof asn1js.Set)) {
    throw new Error('embedTimestampToken: signerInfos is not a SET')
  }

  // We sign with a single signer.
  const siChildren = signerInfos.valueBlock.value
  const signerInfo = siChildren[siChildren.length - 1]
  if (!(signerInfo instanceof asn1js.Sequence)) {
    throw new Error('embedTimestampToken: SignerInfo is not a SEQUENCE')
  }

  // Build Attribute ::= SEQUENCE { attrType OID, attrValues SET { token } }.
  const tokenAsn1 = asn1js.fromBER(toArrayBuffer(tsToken))
  if (tokenAsn1.offset === -1) {
    throw new Error('embedTimestampToken: timestamp token is unparseable')
  }
  const attribute = new asn1js.Sequence({
    value: [
      new asn1js.ObjectIdentifier({ value: OID_TIMESTAMP_TOKEN }),
      new asn1js.Set({ value: [tokenAsn1.result] }),
    ],
  })

  // unsignedAttrs [1] IMPLICIT SET OF Attribute.
  const unsignedAttrs = new asn1js.Constructed({
    idBlock: { tagClass: 3 /* context-specific */, tagNumber: 1 },
    value: [attribute],
  })

  signerInfo.valueBlock.value.push(unsignedAttrs)

  return Buffer.from(contentInfo.toBER(false))
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  // Copy into a fresh ArrayBuffer (never SharedArrayBuffer) so the result is
  // strictly typed as ArrayBuffer for asn1js.
  const out = new ArrayBuffer(buf.byteLength)
  new Uint8Array(out).set(buf)
  return out
}

/**
 * Decode the bundled/injected p12 with node-forge: extract the private key and
 * the full certificate chain (signer first).
 */
function loadKeyAndChain(): LoadedCert {
  const { p12Der, passphrase } = loadSigningCert()
  const p12Asn1 = forge.asn1.fromDer(
    forge.util.createBuffer(p12Der.toString('binary'))
  )
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase)

  // Private key.
  const keyBags = p12.getBags({
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
  })
  let keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
  if (!keyBag) {
    const plainKeyBags = p12.getBags({ bagType: forge.pki.oids.keyBag })
    keyBag = plainKeyBags[forge.pki.oids.keyBag]?.[0]
  }
  const privateKey = keyBag?.key as forge.pki.rsa.PrivateKey | undefined
  if (!privateKey) {
    throw new Error('PadesSigner: no private key found in p12')
  }

  // Certificate chain.
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const certs = (certBags[forge.pki.oids.certBag] ?? [])
    .map((b) => b.cert)
    .filter((c): c is forge.pki.Certificate => !!c)
  if (certs.length === 0) {
    throw new Error('PadesSigner: no certificate found in p12')
  }

  return { privateKey, certificate: certs[0], chain: certs }
}

export class PadesSigner extends Signer {
  /** Set after sign() runs so the orchestrator can report the achieved profile. */
  public lastSignatureProfile: SignatureProfile = 'CAdES-BES'

  /**
   * @param pdfBuffer the ByteRange bytes (PDF with the signature gap removed),
   *   passed in by @signpdf's SignPdf.sign().
   * @param signingTime optional signing time forwarded by SignPdf.sign().
   * @returns raw DER bytes of the detached PKCS#7 SignedData.
   */
  async sign(pdfBuffer: Buffer, signingTime?: Date): Promise<Buffer> {
    const { privateKey, certificate, chain } = loadKeyAndChain()

    const p7 = forge.pkcs7.createSignedData()
    p7.content = forge.util.createBuffer(pdfBuffer.toString('binary'))

    // Full chain so verifiers can build the path.
    for (const cert of chain) {
      p7.addCertificate(cert)
    }

    p7.addSigner({
      key: privateKey,
      certificate,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        // messageDigest is computed by forge from the content.
        { type: forge.pki.oids.messageDigest },
        {
          type: forge.pki.oids.signingTime,
          // forge encodes the Date; default to now if not provided.
          value: (signingTime ?? new Date()).toISOString(),
        },
      ],
    })

    // Detached: the content is NOT embedded (PAdES requires it).
    p7.sign({ detached: true })

    const besDer = Buffer.from(
      forge.asn1.toDer(p7.toAsn1()).getBytes(),
      'binary'
    )

    // CAdES-BES is the floor. Try to upgrade to CAdES-T.
    if (!env.SIGNING_ENABLED) {
      this.lastSignatureProfile = 'CAdES-BES'
      return besDer
    }

    try {
      const signatureValue = extractSignatureValue(p7)
      const tsToken = await getTimestampToken(
        createHash('sha256').update(signatureValue).digest()
      )
      const tDer = embedTimestampToken(besDer, tsToken)
      this.lastSignatureProfile = 'CAdES-T'
      return tDer
    } catch (err) {
      // Never fail completion over a timestamp: fall back to CAdES-BES.
      console.warn(
        '[PadesSigner] TSA timestamp failed; falling back to CAdES-BES:',
        err instanceof Error ? err.message : err
      )
      this.lastSignatureProfile = 'CAdES-BES'
      return besDer
    }
  }
}

/**
 * Pull the raw signature OCTET STRING bytes out of the forge SignedData's single
 * SignerInfo. The timestamp is taken over THIS value per RFC 3161 / CAdES-T.
 */
function extractSignatureValue(p7: forge.pkcs7.PkcsSignedData): Buffer {
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes()
  const root = asn1js.fromBER(
    toArrayBuffer(Buffer.from(der, 'binary'))
  )
  const contentInfo = root.result as asn1js.Sequence
  const explicitContent = contentInfo.valueBlock.value[1] as asn1js.Constructed
  const signedData = explicitContent.valueBlock.value[0] as asn1js.Sequence
  const sdChildren = signedData.valueBlock.value
  const signerInfos = sdChildren[sdChildren.length - 1] as asn1js.Set
  const signerInfo = signerInfos.valueBlock.value[
    signerInfos.valueBlock.value.length - 1
  ] as asn1js.Sequence

  // SignerInfo: version, sid, digestAlg, [0] signedAttrs?, sigAlg, signature.
  // The signature is the last OCTET STRING (primitive, universal tag 4) in the
  // sequence — and it directly follows the signatureAlgorithm SEQUENCE.
  const items = signerInfo.valueBlock.value
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (
      item instanceof asn1js.OctetString &&
      item.idBlock.tagClass === 1 &&
      item.idBlock.tagNumber === 4
    ) {
      return Buffer.from(item.valueBlock.valueHexView)
    }
  }
  throw new Error('extractSignatureValue: no signature OCTET STRING found')
}
