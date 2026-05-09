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
  downloads: { name: string; url: string }[],
  certificateUrl: string
) {
  const docList = downloads
    .map(
      (d) => `
        <tr>
          <td style="padding: 8px 0;">
            <a href="${d.url}" style="color: #2b5cff; text-decoration: none; font-weight: 500;">📄 ${d.name}</a>
          </td>
        </tr>`
    )
    .join('')

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `"${envelopeSubject}" has been completed`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Document Completed</h2>
        <p>Hi ${signerName},</p>
        <p>All parties have signed <strong>"${envelopeSubject}"</strong>. Your signed copies are ready to download.</p>

        <table style="margin: 24px 0; width: 100%; border-collapse: collapse;">
          ${docList}
          <tr>
            <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
              <a href="${certificateUrl}" style="color: #64748b; text-decoration: none; font-size: 14px;">📜 Certificate of Completion</a>
            </td>
          </tr>
        </table>

        <p style="color: #64748b; font-size: 14px;">
          Each link opens the sealed PDF. Save copies for your records — links remain accessible while your account is active.
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
