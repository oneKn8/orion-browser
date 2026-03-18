/**
 * @license
 * Copyright 2025 Orion
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { getWebSocketPort } from '@/utils/ConfigHelper'
import { startKeepAlive, stopKeepAlive } from '@/utils/KeepAlive'
import { logger } from '@/utils/logger'
import { OrionController } from './OrionController'

const STATS_LOG_INTERVAL_MS = 30000

interface ControllerState {
  controller: OrionController | null
  initPromise: Promise<OrionController> | null
  statsTimer: ReturnType<typeof setInterval> | null
}

type OrionGlobals = typeof globalThis & {
  __orionControllerState?: ControllerState
  __orionController?: OrionController | null
}

const globals = globalThis as OrionGlobals
const controllerState: ControllerState =
  globals.__orionControllerState ??
  (() => {
    const state: ControllerState = {
      controller: globals.__orionController ?? null,
      initPromise: null,
      statsTimer: null,
    }
    globals.__orionControllerState = state
    return state
  })()

function setDebugController(controller: OrionController | null): void {
  globals.__orionController = controller
}

function startStatsTimer(): void {
  if (controllerState.statsTimer) {
    return
  }

  controllerState.statsTimer = setInterval(() => {
    controllerState.controller?.logStats()
  }, STATS_LOG_INTERVAL_MS)
}

function stopStatsTimer(): void {
  if (!controllerState.statsTimer) {
    return
  }

  clearInterval(controllerState.statsTimer)
  controllerState.statsTimer = null
}

async function getOrCreateController(): Promise<OrionController> {
  if (controllerState.controller) {
    return controllerState.controller
  }

  if (!controllerState.initPromise) {
    controllerState.initPromise = (async () => {
      try {
        await startKeepAlive()
        const controller = new OrionController(getWebSocketPort)
        await controller.start()

        controllerState.controller = controller
        setDebugController(controller)
        startStatsTimer()

        return controller
      } catch (error) {
        controllerState.controller = null
        setDebugController(null)
        stopStatsTimer()
        try {
          await stopKeepAlive()
        } catch {
          // ignore
        }
        throw error
      } finally {
        controllerState.initPromise = null
      }
    })()
  }

  const initPromise = controllerState.initPromise
  if (!initPromise) {
    throw new Error('Controller init promise missing')
  }
  return initPromise
}

async function shutdownController(reason: string): Promise<void> {
  logger.info('Controller shutdown requested', { reason })

  if (controllerState.initPromise) {
    try {
      await controllerState.initPromise
    } catch {
      // ignore start errors during shutdown
    }
  }

  const controller = controllerState.controller
  if (!controller) {
    try {
      await stopKeepAlive()
    } catch {
      // ignore
    }
    stopStatsTimer()
    setDebugController(null)
    return
  }

  controller.stop()
  controllerState.controller = null
  setDebugController(null)
  stopStatsTimer()

  try {
    await stopKeepAlive()
  } catch {
    // ignore
  }
}

function ensureControllerRunning(trigger: string): void {
  getOrCreateController().catch((error) => {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error)
    logger.error('Controller failed to start', { trigger, error: message })
  })
}

logger.info('Extension loaded')

chrome.runtime.onInstalled.addListener(() => {
  logger.info('Extension installed')
})

chrome.runtime.onStartup.addListener(() => {
  logger.info('Browser startup event')
  ensureControllerRunning('runtime.onStartup')
})

// Immediately attempt to start the controller when the service worker initializes
ensureControllerRunning('service-worker-init')

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    return
  }

  notifyWindowFocused(windowId).catch((error) => {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error)
    logger.warn('Failed to notify focus change', { windowId, error: message })
  })
})

chrome.windows.onCreated.addListener((window) => {
  logger.info('Window created event received', { windowId: window.id })

  if (window.id === undefined) {
    return
  }

  notifyWindowCreated(window.id).catch((error) => {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error)
    logger.warn('Failed to notify window created', {
      windowId: window.id,
      error: message,
    })
  })
})

chrome.windows.onRemoved.addListener((windowId) => {
  notifyWindowRemoved(windowId).catch((error) => {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error)
    logger.warn('Failed to notify window removed', { windowId, error: message })
  })
})

chrome.runtime.onSuspend?.addListener(() => {
  logger.info('Extension suspending')
  void shutdownController('runtime.onSuspend')
})

async function notifyWindowFocused(windowId: number): Promise<void> {
  const controller = await getOrCreateController()
  controller.notifyWindowFocused(windowId)
}

async function notifyWindowCreated(windowId: number): Promise<void> {
  const controller = await getOrCreateController()
  controller.notifyWindowCreated(windowId)
}

async function notifyWindowRemoved(windowId: number): Promise<void> {
  const controller = await getOrCreateController()
  controller.notifyWindowRemoved(windowId)
}
