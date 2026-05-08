import { NextResponse } from 'next/server'
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/lib/db'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function pingDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (err) {
    logger.error(err, { check: 'db' })
    return false
  }
}

async function pingR2(): Promise<boolean> {
  try {
    const client = new S3Client({
      region: 'auto',
      endpoint:
        env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    })
    await client.send(new HeadBucketCommand({ Bucket: env.R2_BUCKET_NAME }))
    return true
  } catch (err) {
    logger.error(err, { check: 'r2' })
    return false
  }
}

export async function GET() {
  const [db, r2] = await Promise.all([pingDb(), pingR2()])
  const resend = env.RESEND_API_KEY.startsWith('re_')
  const allOk = db && r2 && resend
  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      checks: { db, r2, resend },
      ts: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  )
}
