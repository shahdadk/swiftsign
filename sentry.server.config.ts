import * as Sentry from '@sentry/nextjs'
import { scrubSecrets } from '@/lib/secret-scrub'

const dsn = process.env.SENTRY_DSN
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    sendDefaultPii: false,
    beforeSend: (event) => scrubSecrets(event),
    beforeSendTransaction: (event) => scrubSecrets(event),
  })
}
