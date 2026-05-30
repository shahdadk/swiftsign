import { describe, it, expect } from 'vitest'
import { problem } from '@/lib/api-errors'

describe('problem', () => {
  it('maps envelope_quota_exceeded to a 402 problem+json response', async () => {
    const res = problem('envelope_quota_exceeded')
    expect(res.status).toBe(402)
    expect(res.headers.get('content-type')).toBe('application/problem+json')

    const body = await res.json()
    expect(body.code).toBe('envelope_quota_exceeded')
    expect(body.type).toBe('https://swiftsign.ca/errors/envelope_quota_exceeded')
    expect(body.status).toBe(402)
    expect(typeof body.request_id).toBe('string')
    expect(body.request_id).toMatch(/^req_/)
  })

  it('echoes the request id into the x-request-id header', async () => {
    const res = problem('not_found')
    const body = await res.json()
    expect(res.headers.get('x-request-id')).toBe(body.request_id)
  })

  it('passes extension members through as top-level body fields', async () => {
    const res = problem('rate_limited', { retry_after: 30, scope: 'envelopes' })
    const body = await res.json()
    expect(body.retry_after).toBe(30)
    expect(body.scope).toBe('envelopes')
    // Reserved option keys must NOT leak into the body as extensions.
    expect(body.requestId).toBeUndefined()
  })

  it('honors an explicit status override', () => {
    expect(problem('internal_error', { status: 503 }).status).toBe(503)
  })
})
