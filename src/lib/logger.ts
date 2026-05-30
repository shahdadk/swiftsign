import { env } from './env'
import { scrubSecrets } from './secret-scrub'

type Level = 'debug' | 'info' | 'warn' | 'error'
type Ctx = Record<string, unknown> | undefined

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const minLevel: Level =
  (process.env.LOG_LEVEL as Level | undefined) ??
  (env.NODE_ENV === 'production' ? 'info' : 'debug')

function emit(level: Level, msg: string, ctx?: Ctx) {
  if (order[level] < order[minLevel]) return
  // Scrub the message + context (which includes any serialized error
  // stack/message) so a raw key/secret never reaches console output.
  const line = JSON.stringify(
    scrubSecrets({
      level,
      msg,
      ts: new Date().toISOString(),
      ...ctx,
    })
  )
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      err: { name: err.name, message: err.message, stack: err.stack },
    }
  }
  return { err: String(err) }
}

export const logger = {
  debug(msg: string, ctx?: Ctx) {
    emit('debug', msg, ctx)
  },
  info(msg: string, ctx?: Ctx) {
    emit('info', msg, ctx)
  },
  warn(msg: string, ctx?: Ctx) {
    emit('warn', msg, ctx)
  },
  error(err: unknown, ctx?: Ctx) {
    const errCtx = serializeError(err)
    emit('error', errCtx.err && typeof errCtx.err === 'object' ? (errCtx.err as { message: string }).message : String(err), {
      ...ctx,
      ...errCtx,
    })
  },
}
