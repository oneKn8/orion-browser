/**
 * @public
 */
export async function openSidePanel(
  tabId: number,
): Promise<{ opened: boolean }> {
  // @ts-expect-error orionIsOpen is a Orion-specific API
  const isAlreadyOpen = await chrome.sidePanel.orionIsOpen({ tabId })
  if (isAlreadyOpen) {
    return { opened: true }
  }
  // @ts-expect-error orionToggle is a Orion-specific API
  return await chrome.sidePanel.orionToggle({ tabId })
}

/**
 * @public
 */
export async function toggleSidePanel(
  tabId: number,
): Promise<{ opened: boolean }> {
  // @ts-expect-error orionToggle is a Orion-specific API
  return await chrome.sidePanel.orionToggle({ tabId })
}
