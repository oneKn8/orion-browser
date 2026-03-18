diff --git a/chrome/browser/orion/core/orion_constants.h b/chrome/browser/orion/core/orion_constants.h
new file mode 100644
index 0000000000000..e554c96adc5ad
--- /dev/null
+++ b/chrome/browser/orion/core/orion_constants.h
@@ -0,0 +1,227 @@
+// Copyright 2024 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_ORION_CORE_ORION_CONSTANTS_H_
+#define CHROME_BROWSER_ORION_CORE_ORION_CONSTANTS_H_
+
+#include <cstddef>
+#include <string>
+#include <string_view>
+#include <vector>
+
+#include "base/command_line.h"
+#include "chrome/browser/orion/core/orion_switches.h"
+
+namespace orion {
+
+// Check if URL overrides are disabled via command line flag
+inline bool IsURLOverridesDisabled() {
+  return base::CommandLine::ForCurrentProcess()->HasSwitch(kDisableUrlOverrides);
+}
+
+// Agent V2 Extension ID
+inline constexpr char kAgentV2ExtensionId[] =
+    "bflpfmnmnokmjhmgnolecpppdbdophmk";
+
+// Orion extension config URLs
+inline constexpr char kOrionConfigUrl[] =
+    "https://cdn.orion-browser.local/extensions/extensions.json";
+inline constexpr char kOrionAlphaConfigUrl[] =
+    "https://cdn.orion-browser.local/extensions/extensions.alpha.json";
+
+// Bug Reporter Extension ID
+inline constexpr char kBugReporterExtensionId[] =
+    "adlpneommgkgeanpaekgoaolcpncohkf";
+
+// Controller Extension ID
+inline constexpr char kControllerExtensionId[] =
+    "nlnihljpboknmfagkikhkdblbedophja";
+
+// uBlock Origin Extension ID (Chrome Web Store)
+// inline constexpr char kUBlockOriginExtensionId[] =
+//     "cjpalhdlnbpafiamejdnhcphjbkeiagm";
+
+// Orion CDN update manifest URL
+// Used for extensions installed from local .crx files that don't have
+// an update_url in their manifest
+inline constexpr char kOrionUpdateUrl[] =
+    "https://cdn.orion-browser.local/extensions/update-manifest.xml";
+inline constexpr char kOrionAlphaUpdateUrl[] =
+    "https://cdn.orion-browser.local/extensions/update-manifest.alpha.xml";
+
+// chrome://orion host constant
+inline constexpr char kOrionHost[] = "orion";
+
+// URL route mapping for chrome://orion/* virtual URLs
+struct OrionURLRoute {
+  const char* virtual_path;    // Path in chrome://orion/*, e.g., "/ai"
+  const char* extension_id;    // Extension that handles this route
+  const char* extension_page;  // Page within extension, e.g., "options.html"
+  const char* extension_hash;  // Hash/fragment without #, e.g., "ai" (empty if none)
+};
+
+inline constexpr OrionURLRoute kOrionURLRoutes[] = {
+    {"/settings", kAgentV2ExtensionId, "app.html", "/settings"},
+    {"/mcp", kAgentV2ExtensionId, "app.html", "/mcp"},
+    {"/onboarding", kAgentV2ExtensionId, "app.html", "/onboarding"},
+};
+
+inline constexpr size_t kOrionURLRoutesCount =
+    sizeof(kOrionURLRoutes) / sizeof(kOrionURLRoutes[0]);
+
+// Find a route for a given virtual path (e.g., "/ai")
+// Returns nullptr if no matching route found
+inline const OrionURLRoute* FindOrionRoute(std::string_view path) {
+  for (const auto& route : kOrionURLRoutes) {
+    if (path == route.virtual_path) {
+      return &route;
+    }
+  }
+  return nullptr;
+}
+
+// Get the extension URL for a chrome://orion/* path
+// Returns empty string if no matching route or if URL overrides are disabled
+// Example: "/ai" -> "chrome-extension://bflp.../options.html#ai"
+inline std::string GetOrionExtensionURL(std::string_view virtual_path) {
+  if (IsURLOverridesDisabled()) {
+    return std::string();
+  }
+  const OrionURLRoute* route = FindOrionRoute(virtual_path);
+  if (!route) {
+    return std::string();
+  }
+  std::string url = std::string("chrome-extension://") + route->extension_id +
+                    "/" + route->extension_page;
+  if (route->extension_hash[0] != '\0') {
+    url += "#";
+    url += route->extension_hash;
+  }
+  return url;
+}
+
+// Check if an extension URL matches a Orion route
+// If matched, returns the virtual URL (chrome://orion/...)
+// Returns empty string if not a Orion extension URL
+// Parameters:
+//   extension_id: from url.host()
+//   extension_path: from url.path(), e.g., "/options.html"
+//   extension_ref: from url.ref(), e.g., "ai" or "/ai" (normalized internally)
+// Fallback: If no exact hash match, falls back to route with empty hash for same page
+inline std::string GetOrionVirtualURL(std::string_view extension_id,
+                                          std::string_view extension_path,
+                                          std::string_view extension_ref) {
+  if (IsURLOverridesDisabled()) {
+    return std::string();
+  }
+
+  // Normalize ref - strip leading slash if present (handles both #ai and #/ai)
+  std::string normalized_ref(extension_ref);
+  if (!normalized_ref.empty() && normalized_ref[0] == '/') {
+    normalized_ref = normalized_ref.substr(1);
+  }
+
+  const OrionURLRoute* fallback_route = nullptr;
+
+  for (const auto& route : kOrionURLRoutes) {
+    if (extension_id != route.extension_id) {
+      continue;
+    }
+
+    // Compare path (handle leading slash)
+    std::string route_path = std::string("/") + route.extension_page;
+    if (extension_path != route_path && extension_path != route.extension_page) {
+      continue;
+    }
+
+    // Exact hash match - normalize route hash the same way (strip leading /)
+    std::string normalized_hash(route.extension_hash);
+    if (!normalized_hash.empty() && normalized_hash[0] == '/') {
+      normalized_hash = normalized_hash.substr(1);
+    }
+    if (normalized_ref == normalized_hash) {
+      return std::string("chrome://") + kOrionHost + route.virtual_path;
+    }
+
+    // Track fallback: route with empty hash for same page
+    if (route.extension_hash[0] == '\0') {
+      fallback_route = &route;
+    }
+  }
+
+  // No exact match - use fallback if available
+  if (fallback_route) {
+    return std::string("chrome://") + kOrionHost + fallback_route->virtual_path;
+  }
+
+  return std::string();
+}
+
+struct OrionExtensionInfo {
+  const char* id;
+  bool is_pinned;
+  bool is_labelled;
+};
+
+inline constexpr OrionExtensionInfo kOrionExtensions[] = {
+    {kAgentV2ExtensionId, false, false},
+    {kBugReporterExtensionId, true, false},
+    {kControllerExtensionId, false, false},
+    // ublock origin gets installed from chrome web store
+    // {kUBlockOriginExtensionId, false, false},
+};
+
+inline constexpr size_t kOrionExtensionsCount =
+    sizeof(kOrionExtensions) / sizeof(kOrionExtensions[0]);
+
+inline const OrionExtensionInfo* FindOrionExtensionInfo(
+    const std::string& extension_id) {
+  for (const auto& info : kOrionExtensions) {
+    if (extension_id == info.id)
+      return &info;
+  }
+  return nullptr;
+}
+
+// Check if an extension is a Orion extension
+inline bool IsOrionExtension(const std::string& extension_id) {
+  return FindOrionExtensionInfo(extension_id) != nullptr;
+}
+
+inline bool IsOrionPinnedExtension(const std::string& extension_id) {
+  const OrionExtensionInfo* info =
+      FindOrionExtensionInfo(extension_id);
+  return info && info->is_pinned;
+}
+
+inline bool IsOrionLabelledExtension(const std::string& extension_id) {
+  const OrionExtensionInfo* info =
+      FindOrionExtensionInfo(extension_id);
+  return info && info->is_labelled;
+}
+
+// Returns true if this extension uses the contextual (tab-specific) side panel
+// toggle behavior. Currently only Agent V2 uses this.
+inline bool UsesContextualSidePanelToggle(const std::string& extension_id) {
+  return extension_id == kAgentV2ExtensionId;
+}
+
+// Get all Orion extension IDs
+inline std::vector<std::string> GetOrionExtensionIds() {
+  std::vector<std::string> ids;
+  ids.reserve(kOrionExtensionsCount);
+  for (const auto& info : kOrionExtensions)
+    ids.push_back(info.id);
+  return ids;
+}
+
+// Sentry crash reporting
+// https://9a76046fcfbcfe69a3580f4d204579f1@o4510545525932032.ingest.us.sentry.io/4510938172620800
+inline constexpr char kSentryMinidumpUrl[] =
+    "https://o4510545525932032.ingest.us.sentry.io/api/4510938172620800/"
+    "minidump/?sentry_key=9a76046fcfbcfe69a3580f4d204579f1";
+
+}  // namespace orion
+
+#endif  // CHROME_BROWSER_ORION_CORE_ORION_CONSTANTS_H_
