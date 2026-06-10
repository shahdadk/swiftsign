import { Resend } from 'resend'
import { env } from './env'

let cached: Resend | null = null

function getResend(): Resend {
  if (cached) return cached
  cached = new Resend(env.RESEND_API_KEY)
  return cached
}

const FROM = env.EMAIL_FROM

export async function sendSigningRequest(
  to: string,
  signerName: string,
  senderName: string,
  documentName: string,
  signingUrl: string
) {
  await getResend().emails.send({
    from: FROM,
    to,
    subject: `${senderName} has sent you "${documentName}" to sign`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Document Ready for Signing</h2>
        <p>Hi ${signerName},</p>
        <p><strong>${senderName}</strong> has sent you <strong>"${documentName}"</strong> to review and sign.</p>
        <p style="margin: 32px 0;">
          <a href="${signingUrl}"
             style="background: #0f172a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            Review &amp; Sign
          </a>
        </p>
        <p style="color: #64748b; font-size: 14px;">
          This is a secure signing request from SwiftSign. If you did not expect this document, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}

export async function sendCompleted(
  to: string,
  signerName: string,
  envelopeSubject: string,
  attachments: { filename: string; content: Buffer }[],
  opts: {
    downloadLinks?: { filename: string; url: string }[]
    certificateUrl?: string | null
  } = {}
) {
  // The signed PDF is the deliverable. It's attached inline when small enough,
  // or offered as a download link when the payload would exceed Resend's cap.
  // The Certificate of Completion is offered as a link, not an attachment.
  const { downloadLinks = [], certificateUrl = null } = opts
  const useLinks = attachments.length === 0 && downloadLinks.length > 0

  const docRows = useLinks
    ? downloadLinks
        .map(
          (d) => `
        <tr>
          <td style="padding: 6px 0;">
            <a href="${d.url}" style="color: #2563eb; font-weight: 600; text-decoration: none;">📄 ${d.filename}</a>
            <span style="color: #94a3b8; font-size: 12px;"> &middot; download</span>
          </td>
        </tr>`
        )
        .join('')
    : attachments
        .map(
          (d) => `
        <tr>
          <td style="padding: 6px 0;">
            <span style="color: #1f2937; font-weight: 500;">📄 ${d.filename}</span>
            <span style="color: #94a3b8; font-size: 12px;"> &middot; attached</span>
          </td>
        </tr>`
        )
        .join('')

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `"${envelopeSubject}" — signed and sealed`,
    attachments: attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Signed and Sealed</h2>
        <p>Hi ${signerName},</p>
        <p>All parties have signed <strong>"${envelopeSubject}"</strong>. Your signed document ${useLinks ? 'is ready to download below' : 'is attached to this email'}.</p>

        <table style="margin: 20px 0; width: 100%; border-collapse: collapse;">
          ${docRows}
        </table>

        <p style="color: #64748b; font-size: 14px;">
          Each PDF carries a SHA-256 integrity hash for tamper-evidence.${
            certificateUrl
              ? ` Need the full audit trail? <a href="${certificateUrl}" style="color: #2563eb;">Download the Certificate of Completion</a> — it records every signer's name, email, IP, and timestamps.`
              : ''
          } Save your signed copy for your records.
        </p>
      </div>
    `,
  })
}

export async function sendNextSigner(
  to: string,
  signerName: string,
  senderName: string,
  documentName: string,
  signingUrl: string
) {
  await getResend().emails.send({
    from: FROM,
    to,
    subject: `It's your turn to sign "${documentName}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Turn to Sign</h2>
        <p>Hi ${signerName},</p>
        <p><strong>${senderName}</strong> has sent you <strong>"${documentName}"</strong>. All previous signers have completed — it's now your turn.</p>
        <p style="margin: 32px 0;">
          <a href="${signingUrl}"
             style="background: #0f172a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            Review &amp; Sign
          </a>
        </p>
        <p style="color: #64748b; font-size: 14px;">
          This is a secure signing request from SwiftSign. If you did not expect this document, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}

export async function sendDunning(
  to: string,
  name: string,
  opts: { reason: 'payment_failed' | 'action_required'; graceEndsAt?: Date }
) {
  const billingUrl = `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing`

  const body =
    opts.reason === 'payment_failed'
      ? `<p>Your latest SwiftSign payment failed.${
          opts.graceEndsAt
            ? ` If it isn't resolved by <strong>${opts.graceEndsAt.toLocaleDateString()}</strong>, your subscription will be paused.`
            : ' Please update your payment method to keep your subscription active.'
        }</p>`
      : `<p>Your bank needs to confirm your latest SwiftSign payment. Until you confirm it, the payment can't go through.</p>`

  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Action needed: your SwiftSign payment',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Action needed on your payment</h2>
        <p>Hi ${name},</p>
        ${body}
        <p style="margin: 32px 0;">
          <a href="${billingUrl}"
             style="background: #0f172a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            Update payment method
          </a>
        </p>
        <p style="color: #64748b; font-size: 14px;">
          If you've already taken care of this, you can ignore this email.
        </p>
      </div>
    `,
  })
}

export async function sendReceipt(
  to: string,
  name: string,
  opts: {
    amount: number
    currency: string
    periodStart?: Date
    periodEnd?: Date
    invoiceUrl?: string
  }
) {
  const formattedAmount = `$${(opts.amount / 100).toFixed(2)} ${opts.currency.toUpperCase()}`
  const period =
    opts.periodStart && opts.periodEnd
      ? `<p style="color: #475569;">Billing period: ${opts.periodStart.toLocaleDateString()} – ${opts.periodEnd.toLocaleDateString()}</p>`
      : ''

  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Your SwiftSign receipt',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment received</h2>
        <p>Hi ${name},</p>
        <p>Thanks for your payment. Here's your receipt.</p>
        <p style="font-size: 20px; font-weight: 600; color: #0f172a; margin: 16px 0;">${formattedAmount}</p>
        ${period}
        ${
          opts.invoiceUrl
            ? `<p style="margin: 32px 0;">
                <a href="${opts.invoiceUrl}"
                   style="background: #0f172a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                  View invoice
                </a>
              </p>`
            : ''
        }
        <p style="color: #64748b; font-size: 14px;">
          Keep this receipt for your records. Thanks for using SwiftSign.
        </p>
      </div>
    `,
  })
}

export async function sendMagicLink(to: string, link: string) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: 'Sign in to SwiftSign',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #111; font-size: 20px; margin-bottom: 8px;">Sign in to SwiftSign</h2>
        <p style="color: #666; font-size: 14px; margin-bottom: 24px;">Click the button below to sign in to your dashboard.</p>
        <a href="${link}" style="display: inline-block; background: #2b5cff; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 14px;">Sign in</a>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  })
}
