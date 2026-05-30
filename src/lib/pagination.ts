import { z } from 'zod'

// Opaque keyset (cursor) pagination over (createdAt desc, id desc). Stable
// under inserts, unlike offset pagination. Response shape: { data, has_more,
// next_cursor }. The cursor encodes the last row's (createdAt, id).

export interface Page<T> {
  data: T[]
  has_more: boolean
  next_cursor: string | null
}

interface Cursorable {
  id: string
  createdAt: Date
}

export const DEFAULT_LIMIT = 25
export const MAX_LIMIT = 100

export function parseLimit(raw: string | null | undefined): number {
  if (!raw) return DEFAULT_LIMIT
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT
  return Math.min(n, MAX_LIMIT)
}

export function encodeCursor(row: Cursorable): string {
  return Buffer.from(
    JSON.stringify({ c: row.createdAt.toISOString(), i: row.id })
  ).toString('base64url')
}

const CursorSchema = z.object({ c: z.string(), i: z.string() })

export function decodeCursor(
  s: string | null | undefined
): { createdAt: Date; id: string } | null {
  if (!s) return null
  try {
    const raw = JSON.parse(Buffer.from(s, 'base64url').toString('utf8'))
    const parsed = CursorSchema.parse(raw)
    const createdAt = new Date(parsed.c)
    if (Number.isNaN(createdAt.getTime())) return null
    return { createdAt, id: parsed.i }
  } catch {
    return null
  }
}

// Prisma `where` fragment selecting rows strictly after the cursor under
// (createdAt desc, id desc) ordering. Spread into the query's where clause.
export function cursorWhere(
  cursor: { createdAt: Date; id: string } | null
): Record<string, unknown> | undefined {
  if (!cursor) return undefined
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  }
}

// Build a Page from rows fetched with `take: limit + 1`.
export function buildPage<T extends Cursorable>(rows: T[], limit: number): Page<T> {
  const hasMore = rows.length > limit
  const data = hasMore ? rows.slice(0, limit) : rows
  const last = data[data.length - 1]
  return {
    data,
    has_more: hasMore,
    next_cursor: hasMore && last ? encodeCursor(last) : null,
  }
}
