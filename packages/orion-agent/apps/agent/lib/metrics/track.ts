import { getOrionAdapter } from '@/lib/orion/adapter'

const versions = {
  extension: null as string | null,
  chromium: null as string | null,
  orion: null as string | null,
}

const adapter = getOrionAdapter()
adapter
  .getVersion()
  .then((v) => {
    versions.chromium = v
  })
  .catch(() => {})
adapter
  .getBrowserosVersion()
  .then((v) => {
    versions.orion = v
  })
  .catch(() => {})

/** @public */
export function track(
  eventName: string,
  properties?: Record<string, unknown>,
): void {
  if (!versions.extension) {
    versions.extension = chrome.runtime.getManifest().version
  }

  adapter
    .logMetric(eventName, {
      extension_version: versions.extension,
      ...(versions.chromium && { chromium_version: versions.chromium }),
      ...(versions.orion && { orion_version: versions.orion }),
      ...properties,
    })
    .catch(() => {})
}
