import crypto from 'crypto'
import { after } from 'next/server'
import { prisma } from './db'
import { env } from './env'
import { logger } from './logger'
import { nextAttemptAt } from './webhook-retry'
import { assertPublicUrl } from './ssrf'

export type WebhookEventType =
  | 'envelope.sent'
  | 'envelope.viewed'
  | 'envelope.signed'
  | 'envelope.completed'
  | 'envelope.declined'
  | 'envelope.voided'

function sign(secret: string, ts: number, body: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${ts}.${body}`)
    .digest('hex')
}

async function deliverOnce(
  endpointId: string,
  url: string,
  secret: string,
  eventType: WebhookEventType,
  eventId: string,
  body: string,
  attempt: number
): Promise<{ ok: boolean; statusCode: number | null; error: string | null }> {
  const ts = Math.floor(Date.now() / 1000)
  const sig = sign(secret, ts, body)
  // SSRF guard: re-validate the destination immediately before connecting so a
  // URL that was public at creation can't be pointed at an internal address.
  try {
    await assertPublicUrl(url)
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'ssrf-blocked'
    logger.warn('Webhook delivery blocked by SSRF guard', { endpointId, url, reason })
    return { ok: false, statusCode: null, error: reason }
  }
  try {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), env.WEBHOOK_TIMEOUT_MS)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'SwiftSign-Event': eventType,
        'SwiftSign-Event-Id': eventId,
        'SwiftSign-Signature': `t=${ts},v1=${sig}`,
        'SwiftSign-Delivery-Attempt': String(attempt),
      },
      body,
      signal: ctrl.signal,
    })
    clearTimeout(timeout)
    return {
      ok: res.ok,
      statusCode: res.status,
      error: res.ok ? null : `HTTP ${res.status}`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn('Webhook delivery failed', { endpointId, url, msg })
    return { ok: false, statusCode: null, error: msg }
  }
}

async function persistDelivery(args: {
  endpointId: string
  eventType: WebhookEventType
  eventId: string
  payload: unknown
  statusCode: number | null
  error: string | null
}) {
  const ok = args.statusCode !== null && args.statusCode >= 200 && args.statusCode < 300
  await prisma.webhookDelivery.create({
    data: {
      endpointId: args.endpointId,
      eventType: args.eventType,
      eventId: args.eventId,
      payload: args.payload as object,
      statusCode: args.statusCode,
      attempts: 1,
      deliveredAt: ok ? new Date() : null,
      lastError: ok ? null : args.error,
      nextAttemptAt: ok ? null : nextAttemptAt(1),
    },
  })
}

export function emit(
  userId: string,
  eventType: WebhookEventType,
  payload: Record<string, unknown>
) {
  // Don't await — fire after the response is sent. Errors logged, never thrown.
  after(async () => {
    try {
      const endpoints = await prisma.webhookEndpoint.findMany({
        where: { userId, isActive: true },
      })
      const matching = endpoints.filter((e) => e.events.includes(eventType))
      if (matching.length === 0) return

      const eventId = `evt_${crypto.randomBytes(12).toString('hex')}`
      const envelope = {
        id: eventId,
        type: eventType,
        createdAt: new Date().toISOString(),
        data: payload,
      }
      const body = JSON.stringify(envelope)

      await Promise.allSettled(
        matching.map(async (ep) => {
          const result = await deliverOnce(
            ep.id,
            ep.url,
            ep.secret,
            eventType,
            eventId,
            body,
            1
          )
          await persistDelivery({
            endpointId: ep.id,
            eventType,
            eventId: `${eventId}-${ep.id}`,
            payload: envelope,
            statusCode: result.statusCode,
            error: result.error,
          })
        })
      )
    } catch (err) {
      logger.error(err, { op: 'webhook.emit', userId, eventType })
    }
  })
}

// Re-attempt a single previously-failed delivery (used by the retry cron)
export async function retryDelivery(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  })
  if (!delivery || delivery.deliveredAt) return
  if (delivery.attempts >= 6) return

  const attempt = delivery.attempts + 1
  const body = JSON.stringify(delivery.payload)
  const eventType = delivery.eventType as WebhookEventType
  const result = await deliverOnce(
    delivery.endpointId,
    delivery.endpoint.url,
    delivery.endpoint.secret,
    eventType,
    delivery.eventId,
    body,
    attempt
  )
  const ok =
    result.statusCode !== null &&
    result.statusCode >= 200 &&
    result.statusCode < 300

  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      attempts: attempt,
      statusCode: result.statusCode,
      lastError: ok ? null : result.error,
      deliveredAt: ok ? new Date() : null,
      nextAttemptAt: ok ? null : attempt >= 6 ? null : nextAttemptAt(attempt),
    },
  })
}
