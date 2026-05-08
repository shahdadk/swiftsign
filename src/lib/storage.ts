import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner'
import { env } from './env'

let cached: S3Client | null = null

function getClient(): S3Client {
  if (cached) return cached
  cached = new S3Client({
    region: 'auto',
    endpoint:
      env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  })
  return cached
}

export async function uploadPdf(key: string, buffer: Buffer): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
    })
  )
}

export async function downloadPdf(key: string): Promise<Buffer> {
  const response = await getClient().send(
    new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    })
  )

  if (!response.Body) {
    throw new Error(`Empty response for key: ${key}`)
  }

  const bytes = await response.Body.transformToByteArray()
  return Buffer.from(bytes)
}

export async function getSignedUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  })
  return presign(getClient(), command, { expiresIn })
}
