import { storage } from '@wxt-dev/storage'
import { sessionStorage } from '@/lib/auth/sessionStorage'
import { getOrionAdapter } from '@/lib/orion/adapter'
import { ORION_PREFS } from '@/lib/orion/prefs'
import { isKimiLaunchEnabled } from '@/lib/feature-flags/kimi-launch'
import type { LlmProviderConfig, LlmProvidersBackup } from './types'
import { uploadLlmProvidersToGraphql } from './uploadLlmProvidersToGraphql'

/** Default provider ID constant */
export const DEFAULT_PROVIDER_ID = 'orion'
const DEFAULT_PROVIDER_NAME = 'Orion'
const KIMI_LAUNCH_PROVIDER_NAME = 'Kimi K2.5'

/** Storage key for LLM providers array */
export const providersStorage = storage.defineItem<LlmProviderConfig[]>(
  'local:llm-providers',
  {
    version: 2,
    migrations: {
      2: (
        providers: LlmProviderConfig[] | null,
      ): LlmProviderConfig[] | null => {
        if (!providers) return providers
        return providers.map((provider) => {
          if (
            provider.id === DEFAULT_PROVIDER_ID &&
            provider.type === 'orion'
          ) {
            return { ...provider, contextWindow: 200000 }
          }
          return provider
        })
      },
    },
  },
)

/** Backup providers to Orion prefs (write-only, best-effort) */
async function backupToOrion(backup: LlmProvidersBackup): Promise<void> {
  try {
    const adapter = getOrionAdapter()
    await adapter.setPref(ORION_PREFS.PROVIDERS, JSON.stringify(backup))
  } catch {
    // Orion API not available - ignore
  }
}

/**
 * Setup one-way sync of LLM providers to Orion prefs
 * @public
 */
export function setupLlmProvidersBackupToOrion(): () => void {
  const unsubscribe = providersStorage.watch(async (providers) => {
    if (providers) {
      const defaultProviderId = await defaultProviderIdStorage.getValue()
      await backupToOrion({ defaultProviderId, providers })
    }
  })
  return unsubscribe
}

export async function syncLlmProviders(): Promise<void> {
  const providers = await providersStorage.getValue()
  if (!providers || providers.length === 0) return

  const session = await sessionStorage.getValue()
  const userId = session?.user?.id
  if (!userId) return

  await uploadLlmProvidersToGraphql(providers, userId)
}

/**
 * Setup one-way sync of LLM providers to GraphQL backend
 * Watches for storage changes and uploads non-sensitive provider data
 * @public
 */
export function setupLlmProvidersSyncToBackend(): () => void {
  syncLlmProviders().catch(() => {})

  const unsubscribe = providersStorage.watch(async () => {
    try {
      await syncLlmProviders()
    } catch {
      // Sync failed silently - will retry on next storage change
    }
  })
  return unsubscribe
}

/** Load providers from storage */
export async function loadProviders(): Promise<LlmProviderConfig[]> {
  const providers = (await providersStorage.getValue()) || []
  const normalizedProviders = normalizeProvidersForLaunch(providers)

  // Keep storage consistent so every consumer sees the same provider name.
  if (
    normalizedProviders.some((provider, index) => provider !== providers[index])
  ) {
    await providersStorage.setValue(normalizedProviders)
  }

  return normalizedProviders
}

/** Creates the default Orion provider configuration */
export function createDefaultOrionProvider(): LlmProviderConfig {
  const timestamp = Date.now()
  return {
    id: DEFAULT_PROVIDER_ID,
    type: 'orion',
    name: getBuiltInProviderName(),
    baseUrl: 'https://api.orion-browser.local/v1',
    modelId: 'orion-auto',
    supportsImages: true,
    contextWindow: 200000,
    temperature: 0.2,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** Creates the default providers configuration. Only call when storage is empty. */
export function createDefaultProvidersConfig(): LlmProviderConfig[] {
  return [createDefaultOrionProvider()]
}

function getBuiltInProviderName(): string {
  return isKimiLaunchEnabled()
    ? KIMI_LAUNCH_PROVIDER_NAME
    : DEFAULT_PROVIDER_NAME
}

function normalizeProvidersForLaunch(
  providers: LlmProviderConfig[],
): LlmProviderConfig[] {
  const builtInProviderName = getBuiltInProviderName()

  return providers.map((provider) => {
    if (
      provider.id === DEFAULT_PROVIDER_ID &&
      provider.type === 'orion' &&
      provider.name !== builtInProviderName
    ) {
      return {
        ...provider,
        name: builtInProviderName,
      }
    }
    return provider
  })
}

/** Storage key for the default provider ID */
export const defaultProviderIdStorage = storage.defineItem<string>(
  'local:default-provider-id',
  {
    fallback: DEFAULT_PROVIDER_ID,
  },
)
