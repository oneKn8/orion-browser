/**
 * @license
 * Copyright 2025 Orion
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/// <reference path="../types/chrome-browser-os.d.ts" />

import { logger } from '@/utils/logger'
import { CHROME_API_TIMEOUTS, withTimeout } from '@/utils/timeout'

// ============= Re-export types from chrome.browserOS namespace =============

export type InteractiveNode = chrome.browserOS.InteractiveNode
export type InteractiveSnapshot = chrome.browserOS.InteractiveSnapshot
export type InteractiveSnapshotOptions =
  chrome.browserOS.InteractiveSnapshotOptions
export type PageLoadStatus = chrome.browserOS.PageLoadStatus
export type InteractiveNodeType = chrome.browserOS.InteractiveNodeType
export type Rect = chrome.browserOS.BoundingRect

// New snapshot types
export type SnapshotType = chrome.browserOS.SnapshotType
export type SnapshotContext = chrome.browserOS.SnapshotContext
export type SectionType = chrome.browserOS.SectionType
export type TextSnapshotResult = chrome.browserOS.TextSnapshotResult
export type LinkInfo = chrome.browserOS.LinkInfo
export type LinksSnapshotResult = chrome.browserOS.LinksSnapshotResult
export type SnapshotSection = chrome.browserOS.SnapshotSection
export type Snapshot = chrome.browserOS.Snapshot
export type SnapshotOptions = chrome.browserOS.SnapshotOptions

export type PrefObject = chrome.browserOS.PrefObject

// ============= Orion Adapter =============

// Screenshot size constants
export const SCREENSHOT_SIZES = {
  small: 512, // Low token usage
  medium: 768, // Balanced (default)
  large: 1028, // High detail (note: 1028 not 1024)
} as const

export type ScreenshotSizeKey = keyof typeof SCREENSHOT_SIZES

/**
 * Adapter for Chrome Orion Extension APIs
 * Provides a clean interface to orion functionality with extensibility
 */
export class OrionAdapter {
  private static instance: OrionAdapter | null = null

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): OrionAdapter {
    if (!OrionAdapter.instance) {
      OrionAdapter.instance = new OrionAdapter()
    }
    return OrionAdapter.instance
  }

  /**
   * Get interactive snapshot of the current page
   */
  async getInteractiveSnapshot(
    tabId: number,
    options?: InteractiveSnapshotOptions,
  ): Promise<InteractiveSnapshot> {
    try {
      logger.debug(
        `[OrionAdapter] Getting interactive snapshot for tab ${tabId} with options: ${JSON.stringify(options)}`,
      )

      const promise = new Promise<InteractiveSnapshot>((resolve, reject) => {
        if (options) {
          chrome.browserOS.getInteractiveSnapshot(
            tabId,
            options,
            (snapshot: InteractiveSnapshot) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
              } else {
                logger.debug(
                  `[OrionAdapter] Retrieved snapshot with ${snapshot.elements.length} elements`,
                )
                resolve(snapshot)
              }
            },
          )
        } else {
          chrome.browserOS.getInteractiveSnapshot(
            tabId,
            (snapshot: InteractiveSnapshot) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
              } else {
                logger.debug(
                  `[OrionAdapter] Retrieved snapshot with ${snapshot.elements.length} elements`,
                )
                resolve(snapshot)
              }
            },
          )
        }
      })

      return withTimeout(
        promise,
        CHROME_API_TIMEOUTS.ORION_HEAVY,
        'getInteractiveSnapshot',
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[OrionAdapter] Failed to get interactive snapshot: ${errorMessage}`,
      )
      throw new Error(`Failed to get interactive snapshot: ${errorMessage}`)
    }
  }

  /**
   * Click an element by node ID
   */
  async click(tabId: number, nodeId: number): Promise<void> {
    try {
      logger.debug(`[OrionAdapter] Clicking node ${nodeId} in tab ${tabId}`)

      const promise = new Promise<void>((resolve, reject) => {
        chrome.browserOS.click(tabId, nodeId, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })

      return withTimeout(promise, CHROME_API_TIMEOUTS.ORION_ACTION, 'click')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[OrionAdapter] Failed to click node: ${errorMessage}`)
      throw new Error(`Failed to click node ${nodeId}: ${errorMessage}`)
    }
  }

  /**
   * Input text into an element
   */
  async inputText(tabId: number, nodeId: number, text: string): Promise<void> {
    try {
      logger.debug(
        `[OrionAdapter] Inputting text into node ${nodeId} in tab ${tabId}`,
      )

      const promise = new Promise<void>((resolve, reject) => {
        chrome.browserOS.inputText(tabId, nodeId, text, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })

      return withTimeout(
        promise,
        CHROME_API_TIMEOUTS.ORION_ACTION,
        'inputText',
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[OrionAdapter] Failed to input text: ${errorMessage}`)
      throw new Error(
        `Failed to input text into node ${nodeId}: ${errorMessage}`,
      )
    }
  }

  /**
   * Clear text from an element
   */
  async clear(tabId: number, nodeId: number): Promise<void> {
    try {
      logger.debug(`[OrionAdapter] Clearing node ${nodeId} in tab ${tabId}`)

      const promise = new Promise<void>((resolve, reject) => {
        chrome.browserOS.clear(tabId, nodeId, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })

      return withTimeout(promise, CHROME_API_TIMEOUTS.ORION_ACTION, 'clear')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[OrionAdapter] Failed to clear node: ${errorMessage}`)
      throw new Error(`Failed to clear node ${nodeId}: ${errorMessage}`)
    }
  }

  /**
   * Scroll to a specific node
   */
  async scrollToNode(tabId: number, nodeId: number): Promise<boolean> {
    try {
      logger.debug(
        `[OrionAdapter] Scrolling to node ${nodeId} in tab ${tabId}`,
      )

      const promise = new Promise<boolean>((resolve, reject) => {
        chrome.browserOS.scrollToNode(tabId, nodeId, (scrolled: boolean) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(scrolled)
          }
        })
      })

      return withTimeout(
        promise,
        CHROME_API_TIMEOUTS.ORION_ACTION,
        'scrollToNode',
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[OrionAdapter] Failed to scroll to node: ${errorMessage}`,
      )
      throw new Error(`Failed to scroll to node ${nodeId}: ${errorMessage}`)
    }
  }

  /**
   * Send keyboard keys
   */
  async sendKeys(tabId: number, keys: chrome.browserOS.Key): Promise<void> {
    try {
      logger.debug(`[OrionAdapter] Sending keys "${keys}" to tab ${tabId}`)

      const promise = new Promise<void>((resolve, reject) => {
        chrome.browserOS.sendKeys(tabId, keys, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })

      return withTimeout(
        promise,
        CHROME_API_TIMEOUTS.ORION_ACTION,
        'sendKeys',
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[OrionAdapter] Failed to send keys: ${errorMessage}`)
      throw new Error(`Failed to send keys: ${errorMessage}`)
    }
  }

  /**
   * Get page load status
   */
  async getPageLoadStatus(tabId: number): Promise<PageLoadStatus> {
    try {
      logger.debug(
        `[OrionAdapter] Getting page load status for tab ${tabId}`,
      )

      const promise = new Promise<PageLoadStatus>((resolve, reject) => {
        chrome.browserOS.getPageLoadStatus(tabId, (status: PageLoadStatus) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(status)
          }
        })
      })

      return withTimeout(
        promise,
        CHROME_API_TIMEOUTS.ORION_HEAVY,
        'getPageLoadStatus',
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[OrionAdapter] Failed to get page load status: ${errorMessage}`,
      )
      throw new Error(`Failed to get page load status: ${errorMessage}`)
    }
  }

  /**
   * Get accessibility tree (if available)
   */
  async getAccessibilityTree(
    tabId: number,
  ): Promise<chrome.browserOS.AccessibilityTree> {
    try {
      logger.debug(
        `[OrionAdapter] Getting accessibility tree for tab ${tabId}`,
      )

      const promise = new Promise<chrome.browserOS.AccessibilityTree>(
        (resolve, reject) => {
          chrome.browserOS.getAccessibilityTree(
            tabId,
            (tree: chrome.browserOS.AccessibilityTree) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
              } else {
                resolve(tree)
              }
            },
          )
        },
      )

      return withTimeout(
        promise,
        CHROME_API_TIMEOUTS.ORION_HEAVY,
        'getAccessibilityTree',
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[OrionAdapter] Failed to get accessibility tree: ${errorMessage}`,
      )
      throw new Error(`Failed to get accessibility tree: ${errorMessage}`)
    }
  }

  /**
   * Capture a screenshot of the tab
   * @param tabId - The tab ID to capture
   * @param size - Optional screenshot size ('small', 'medium', or 'large')
   * @param showHighlights - Optional flag to show element highlights
   * @param width - Optional exact width for screenshot
   * @param height - Optional exact height for screenshot
   */
  async captureScreenshot(
    tabId: number,
    size?: ScreenshotSizeKey,
    showHighlights?: boolean,
    width?: number,
    height?: number,
  ): Promise<string> {
    try {
      const sizeDesc = size ? ` (${size})` : ''
      const highlightDesc = showHighlights ? ' with highlights' : ''
      const dimensionsDesc = width && height ? ` (${width}x${height})` : ''
      logger.debug(
        `[OrionAdapter] Capturing screenshot for tab ${tabId}${sizeDesc}${highlightDesc}${dimensionsDesc}`,
      )

      const promise = new Promise<string>((resolve, reject) => {
        // Use exact dimensions if provided
        if (width !== undefined && height !== undefined) {
          chrome.browserOS.captureScreenshot(
            tabId,
            0, // thumbnailSize ignored when width/height specified
            showHighlights || false,
            width,
            height,
            (dataUrl: string) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
              } else {
                logger.debug(
                  `[OrionAdapter] Screenshot captured for tab ${tabId} (${width}x${height})${highlightDesc}`,
                )
                resolve(dataUrl)
              }
            },
          )
        } else if (size !== undefined || showHighlights !== undefined) {
          const pixelSize = size ? SCREENSHOT_SIZES[size] : 0
          // Use the API with thumbnail size and highlights
          if (showHighlights !== undefined) {
            chrome.browserOS.captureScreenshot(
              tabId,
              pixelSize,
              showHighlights,
              (dataUrl: string) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message))
                } else {
                  logger.debug(
                    `[OrionAdapter] Screenshot captured for tab ${tabId}${sizeDesc}${highlightDesc}`,
                  )
                  resolve(dataUrl)
                }
              },
            )
          } else {
            chrome.browserOS.captureScreenshot(
              tabId,
              pixelSize,
              (dataUrl: string) => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message))
                } else {
                  logger.debug(
                    `[OrionAdapter] Screenshot captured for tab ${tabId} (${size}: ${pixelSize}px)`,
                  )
                  resolve(dataUrl)
                }
              },
            )
          }
        } else {
          // Use the original API without size (backwards compatibility)
          chrome.browserOS.captureScreenshot(tabId, (dataUrl: string) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              logger.debug(
                `[OrionAdapter] Screenshot captured for tab ${tabId}`,
              )
              resolve(dataUrl)
            }
          })
        }
      })

      return withTimeout(
        promise,
        CHROME_API_TIMEOUTS.ORION_HEAVY,
        'captureScreenshot',
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[OrionAdapter] Failed to capture screenshot: ${errorMessage}`,
      )
      throw new Error(`Failed to capture screenshot: ${errorMessage}`)
    }
  }

  /**
   * Get a content snapshot from the page
   */
  async getSnapshot(tabId: number, _type: SnapshotType): Promise<Snapshot> {
    try {
      logger.debug(`[OrionAdapter] Getting snapshot for tab ${tabId}`)

      const promise = new Promise<Snapshot>((resolve, reject) => {
        chrome.browserOS.getSnapshot(tabId, (snapshot: Snapshot) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            logger.debug(
              `[OrionAdapter] Retrieved snapshot: ${JSON.stringify(snapshot)}`,
            )
            resolve(snapshot)
          }
        })
      })

      return withTimeout(
        promise,
        CHROME_API_TIMEOUTS.ORION_HEAVY,
        'getSnapshot',
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[OrionAdapter] Failed to get snapshot: ${errorMessage}`)
      throw new Error(`Failed to get snapshot: ${errorMessage}`)
    }
  }

  /**
   * Get text content snapshot from the page
   * Convenience method (deprecated - use getSnapshot directly)
   * Use getSnapshot(tabId, 'text') instead
   */
  async getTextSnapshot(tabId: number): Promise<Snapshot> {
    return this.getSnapshot(tabId, 'text')
  }

  /**
   * Get links snapshot from the page
   * Convenience method (deprecated - use getSnapshot directly)
   * Use getSnapshot(tabId, 'links') instead
   */
  async getLinksSnapshot(tabId: number): Promise<Snapshot> {
    return this.getSnapshot(tabId, 'links')
  }

  /**
   * Generic method to invoke any Orion API
   * Useful for future APIs or experimental features
   */
  async invokeAPI(method: string, ...args: unknown[]): Promise<unknown> {
    try {
      logger.debug(`[OrionAdapter] Invoking Orion API: ${method}`)

      if (!(method in chrome.browserOS)) {
        throw new Error(`Unknown Orion API method: ${method}`)
      }

      // @ts-expect-error - Dynamic API invocation
      const result = await chrome.browserOS[method](...args)
      return result
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[OrionAdapter] Failed to invoke API ${method}: ${errorMessage}`,
      )
      throw new Error(
        `Failed to invoke Orion API ${method}: ${errorMessage}`,
      )
    }
  }

  /**
   * Check if a specific API is available
   */
  isAPIAvailable(method: string): boolean {
    return method in chrome.browserOS
  }

  /**
   * Get list of available Orion APIs
   */
  getAvailableAPIs(): string[] {
    return Object.keys(chrome.browserOS).filter((key) => {
      // @ts-expect-error - Dynamic key access for API discovery
      return typeof chrome.browserOS[key] === 'function'
    })
  }

  /**
   * Get Orion version information
   */
  async getVersion(): Promise<string | null> {
    try {
      logger.debug('[OrionAdapter] Getting Orion version')

      return new Promise<string | null>((resolve, reject) => {
        // Check if getVersionNumber API is available
        if (
          'getVersionNumber' in chrome.browserOS &&
          typeof chrome.browserOS.getVersionNumber === 'function'
        ) {
          chrome.browserOS.getVersionNumber((version: string) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              logger.debug(`[OrionAdapter] Orion version: ${version}`)
              resolve(version)
            }
          })
        } else {
          // Fallback - return null if API not available
          resolve(null)
        }
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[OrionAdapter] Failed to get version: ${errorMessage}`)
      // Return null on error
      return null
    }
  }

  /**
   * Log a metric event with optional properties
   */
  async logMetric(
    eventName: string,
    properties?: Record<string, unknown>,
  ): Promise<void> {
    try {
      logger.debug(
        `[OrionAdapter] Logging metric: ${eventName} with properties: ${JSON.stringify(properties)}`,
      )

      return new Promise<void>((resolve, reject) => {
        // Check if logMetric API is available
        if (
          'logMetric' in chrome.browserOS &&
          typeof chrome.browserOS.logMetric === 'function'
        ) {
          if (properties) {
            chrome.browserOS.logMetric(eventName, properties, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
              } else {
                logger.debug(`[OrionAdapter] Metric logged: ${eventName}`)
                resolve()
              }
            })
          } else {
            chrome.browserOS.logMetric(eventName, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message))
              } else {
                logger.debug(`[OrionAdapter] Metric logged: ${eventName}`)
                resolve()
              }
            })
          }
        } else {
          // If API not available, log a warning but don't fail
          logger.warn(
            `[OrionAdapter] logMetric API not available, skipping metric: ${eventName}`,
          )
          resolve()
        }
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`[OrionAdapter] Failed to log metric: ${errorMessage}`)
      return
    }
  }

  /**
   * Execute JavaScript code in the specified tab
   * @param tabId - The tab ID to execute code in
   * @param code - The JavaScript code to execute
   * @returns The result of the execution
   */
  async executeJavaScript(tabId: number, code: string): Promise<unknown> {
    try {
      logger.debug(`[OrionAdapter] Executing JavaScript in tab ${tabId}`)

      const promise = new Promise<unknown>((resolve, reject) => {
        // Check if executeJavaScript API is available
        if (
          'executeJavaScript' in chrome.browserOS &&
          typeof chrome.browserOS.executeJavaScript === 'function'
        ) {
          chrome.browserOS.executeJavaScript(tabId, code, (result: unknown) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              logger.debug(
                `[OrionAdapter] JavaScript executed successfully in tab ${tabId}`,
              )
              resolve(result)
            }
          })
        } else {
          reject(new Error('executeJavaScript API not available'))
        }
      })

      return withTimeout(
        promise,
        CHROME_API_TIMEOUTS.ORION_HEAVY,
        'executeJavaScript',
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[OrionAdapter] Failed to execute JavaScript: ${errorMessage}`,
      )
      throw new Error(`Failed to execute JavaScript: ${errorMessage}`)
    }
  }

  /**
   * Click at specific viewport coordinates
   * @param tabId - The tab ID to click in
   * @param x - X coordinate in viewport pixels
   * @param y - Y coordinate in viewport pixels
   */
  async clickCoordinates(tabId: number, x: number, y: number): Promise<void> {
    try {
      logger.debug(
        `[OrionAdapter] Clicking at coordinates (${x}, ${y}) in tab ${tabId}`,
      )

      const promise = new Promise<void>((resolve, reject) => {
        // Check if clickCoordinates API is available
        if (
          'clickCoordinates' in chrome.browserOS &&
          typeof chrome.browserOS.clickCoordinates === 'function'
        ) {
          chrome.browserOS.clickCoordinates(tabId, x, y, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              logger.debug(
                `[OrionAdapter] Successfully clicked at (${x}, ${y}) in tab ${tabId}`,
              )
              resolve()
            }
          })
        } else {
          reject(new Error('clickCoordinates API not available'))
        }
      })

      return withTimeout(
        promise,
        CHROME_API_TIMEOUTS.ORION_ACTION,
        'clickCoordinates',
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[OrionAdapter] Failed to click at coordinates: ${errorMessage}`,
      )
      throw new Error(
        `Failed to click at coordinates (${x}, ${y}): ${errorMessage}`,
      )
    }
  }

  /**
   * Type text at specific viewport coordinates
   * @param tabId - The tab ID to type in
   * @param x - X coordinate in viewport pixels
   * @param y - Y coordinate in viewport pixels
   * @param text - Text to type at the location
   */
  async typeAtCoordinates(
    tabId: number,
    x: number,
    y: number,
    text: string,
  ): Promise<void> {
    try {
      logger.debug(
        `[OrionAdapter] Typing at coordinates (${x}, ${y}) in tab ${tabId}`,
      )

      const promise = new Promise<void>((resolve, reject) => {
        // Check if typeAtCoordinates API is available
        if (
          'typeAtCoordinates' in chrome.browserOS &&
          typeof chrome.browserOS.typeAtCoordinates === 'function'
        ) {
          chrome.browserOS.typeAtCoordinates(tabId, x, y, text, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              logger.debug(
                `[OrionAdapter] Successfully typed "${text}" at (${x}, ${y}) in tab ${tabId}`,
              )
              resolve()
            }
          })
        } else {
          reject(new Error('typeAtCoordinates API not available'))
        }
      })

      return withTimeout(
        promise,
        CHROME_API_TIMEOUTS.ORION_ACTION,
        'typeAtCoordinates',
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(
        `[OrionAdapter] Failed to type at coordinates: ${errorMessage}`,
      )
      throw new Error(
        `Failed to type at coordinates (${x}, ${y}): ${errorMessage}`,
      )
    }
  }

  /**
   * Get a specific preference value
   * @param name - The preference name (e.g., "orion.server.mcp_port")
   * @returns Promise resolving to the preference object containing key, type, and value
   */
  async getPref(name: string): Promise<PrefObject> {
    try {
      console.log(`[OrionAdapter] Getting preference: ${name}`)

      return new Promise<PrefObject>((resolve, reject) => {
        chrome.browserOS.getPref(name, (pref: PrefObject) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            console.log(
              `[OrionAdapter] Retrieved preference ${name}: ${JSON.stringify(pref)}`,
            )
            resolve(pref)
          }
        })
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(
        `[OrionAdapter] Failed to get preference: ${errorMessage}`,
      )
      throw new Error(`Failed to get preference ${name}: ${errorMessage}`)
    }
  }

  /**
   * Set a specific preference value
   * @param name - The preference name (e.g., "orion.server.mcp_enabled")
   * @param value - The value to set
   * @param pageId - Optional page ID for settings tracking
   * @returns Promise resolving to true if successful
   */
  async setPref(
    name: string,
    value: unknown,
    pageId?: string,
  ): Promise<boolean> {
    try {
      console.log(
        `[OrionAdapter] Setting preference ${name} to ${JSON.stringify(value)}`,
      )

      return new Promise<boolean>((resolve, reject) => {
        if (pageId !== undefined) {
          chrome.browserOS.setPref(name, value, pageId, (success: boolean) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              console.log(
                `[OrionAdapter] Successfully set preference ${name}`,
              )
              resolve(success)
            }
          })
        } else {
          chrome.browserOS.setPref(name, value, (success: boolean) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              console.log(
                `[OrionAdapter] Successfully set preference ${name}`,
              )
              resolve(success)
            }
          })
        }
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(
        `[OrionAdapter] Failed to set preference: ${errorMessage}`,
      )
      throw new Error(`Failed to set preference ${name}: ${errorMessage}`)
    }
  }

  /**
   * Get all preferences (filtered to orion.* prefs)
   * @returns Promise resolving to array of preference objects
   */
  async getAllPrefs(): Promise<PrefObject[]> {
    try {
      console.log('[OrionAdapter] Getting all preferences')

      return new Promise<PrefObject[]>((resolve, reject) => {
        chrome.browserOS.getAllPrefs((prefs: PrefObject[]) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            console.log(
              `[OrionAdapter] Retrieved ${prefs.length} preferences`,
            )
            resolve(prefs)
          }
        })
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error(
        `[OrionAdapter] Failed to get all preferences: ${errorMessage}`,
      )
      throw new Error(`Failed to get all preferences: ${errorMessage}`)
    }
  }
}

// Export singleton instance getter for convenience
export const getOrionAdapter = () => OrionAdapter.getInstance()
