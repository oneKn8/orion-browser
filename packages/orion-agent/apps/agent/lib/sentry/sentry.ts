import * as Sentry from '@sentry/react'
import { getOrionAdapter } from '../orion/adapter'
import { env } from '../env'

if (env.VITE_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: env.VITE_PUBLIC_SENTRY_DSN,
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
    environment: env.PROD ? 'production' : 'development',
    release: chrome.runtime.getManifest().version,
  })

  ;(async () => {
    const adapter = getOrionAdapter()
    const chromiumVersion = await adapter.getVersion()
    const orionVersion = await adapter.getOrionVersion()
    Sentry.setTag('chromiumVersion', chromiumVersion)
    Sentry.setTag('orionVersion', orionVersion)
  })()
}

/**
 * @public
 */
export const sentry = Sentry
