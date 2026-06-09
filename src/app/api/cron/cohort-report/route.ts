import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Weekly funnel cohort report: signups by source -> first-send -> paid.
// The war-plan victory metric is paying-account cohorts, not installs; this
// is the instrument that decides which distribution channel gets doubled.

const REPORT_TO = 'shahdadkompanizare@gmail.com'

function authorized(auth: string | null): boolean {
  if (auth === null) return false
  const expected = `Bearer ${env.CRON_SECRET}`
  const a = Buffer.from(auth)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!authorized(auth)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const users = await prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true,
        signupSource: true,
        plan: true,
        envelopes: { select: { id: true }, take: 1 },
      },
    })

    type Row = { signups: number; firstSend: number; paid: number }
    const bySource = new Map<string, Row>()
    for (const u of users) {
      const src = u.signupSource ?? 'untagged'
      const row = bySource.get(src) ?? { signups: 0, firstSend: 0, paid: 0 }
      row.signups += 1
      if (u.envelopes.length > 0) row.firstSend += 1
      if (u.plan !== 'FREE') row.paid += 1
      bySource.set(src, row)
    }

    const totalPaid = await prisma.user.count({ where: { plan: { not: 'FREE' } } })

    const lines = [...bySource.entries()]
      .sort((a, b) => b[1].signups - a[1].signups)
      .map(
        ([src, r]) =>
          `<tr><td style="padding:4px 12px 4px 0">${src}</td><td align="right">${r.signups}</td><td align="right">${r.firstSend}</td><td align="right">${r.paid}</td></tr>`
      )
      .join('')

    const html = `
      <div style="font-family: ui-monospace, Menlo, monospace; max-width: 560px;">
        <h2 style="font-size:16px">SwiftSign weekly cohort — last 7 days</h2>
        <table style="font-size:13px; border-collapse:collapse">
          <tr><th align="left" style="padding-right:12px">source</th><th align="right">signups</th><th align="right">first send</th><th align="right">paid</th></tr>
          ${lines || '<tr><td colspan="4">no signups this week</td></tr>'}
        </table>
        <p style="font-size:13px">Total paying accounts (all time): <b>${totalPaid}</b> / 10 (90-day target)</p>
      </div>`

    const resend = new Resend(env.RESEND_API_KEY)
    await resend.emails.send({
      from: env.EMAIL_FROM,
      to: REPORT_TO,
      subject: `SwiftSign cohorts: ${users.length} signups, ${totalPaid} paying`,
      html,
    })

    logger.info('cohort-report sent', { signups: users.length, totalPaid })
    return NextResponse.json({ ok: true, signups: users.length, totalPaid })
  } catch (err) {
    logger.error(err, { route: 'GET /api/cron/cohort-report' })
    return NextResponse.json({ error: 'cohort report failed' }, { status: 500 })
  }
}
