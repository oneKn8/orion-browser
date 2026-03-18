import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineWebExtConfig } from 'wxt'

// biome-ignore lint/style/noProcessEnv: config file needs env access
const env = process.env

const MONOREPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const CONTROLLER_EXT_DIR = join(MONOREPO_ROOT, 'apps/controller-ext/dist')

const chromiumArgs = [
  '--use-mock-keychain',
  '--show-component-extension-options',
  '--disable-orion-server',
  '--disable-orion-extensions',
  `--load-extension=${CONTROLLER_EXT_DIR}`,
]

if (env.ORION_CDP_PORT) {
  // TODO: replace with --orion-cdp-port once we fix the orion bug
  chromiumArgs.push(`--remote-debugging-port=${env.ORION_CDP_PORT}`)
  // chromiumArgs.push(`--orion-cdp-port =${env.ORION_CDP_PORT}`)
}
if (env.ORION_SERVER_PORT) {
  chromiumArgs.push(`--orion-mcp-port=${env.ORION_SERVER_PORT}`)
  chromiumArgs.push(`--orion-server-port=${env.ORION_SERVER_PORT}`)
  // --disable-orion-server means no proxy is running, so proxy port falls back to server port
  chromiumArgs.push(`--orion-proxy-port=${env.ORION_SERVER_PORT}`)
}
if (env.ORION_EXTENSION_PORT) {
  chromiumArgs.push(
    `--orion-extension-port=${env.ORION_EXTENSION_PORT}`,
  )
}

export default defineWebExtConfig({
  binaries: {
    chrome:
      env.ORION_BINARY ||
      '/Applications/Orion.app/Contents/MacOS/Orion',
  },
  chromiumArgs,
  chromiumProfile: env.ORION_USER_DATA_DIR || '/tmp/orion-dev',
  keepProfileChanges: true,
  startUrls: ['chrome://newtab'],
})
