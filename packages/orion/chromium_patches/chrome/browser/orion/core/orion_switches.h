diff --git a/chrome/browser/orion/core/orion_switches.h b/chrome/browser/orion/core/orion_switches.h
new file mode 100644
index 0000000000000..8d6fcc30fd568
--- /dev/null
+++ b/chrome/browser/orion/core/orion_switches.h
@@ -0,0 +1,86 @@
+// Copyright 2024 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_ORION_CORE_ORION_SWITCHES_H_
+#define CHROME_BROWSER_ORION_CORE_ORION_SWITCHES_H_
+
+namespace orion {
+
+// =============================================================================
+// Orion Command-Line Switches
+// =============================================================================
+// All Orion-specific command-line flags are defined here.
+// Usage: --flag-name or --flag-name=value
+
+// === Server Switches ===
+
+// Disables the Orion server entirely.
+inline constexpr char kDisableServer[] = "disable-orion-server";
+
+// Disables the Orion server OTA updater.
+inline constexpr char kDisableServerUpdater[] = "disable-orion-server-updater";
+
+// Overrides the appcast URL for server updates (testing).
+inline constexpr char kServerAppcastUrl[] = "orion-server-appcast-url";
+
+// Overrides the server resources directory path.
+inline constexpr char kServerResourcesDir[] = "orion-server-resources-dir";
+
+// Overrides the CDP (Chrome DevTools Protocol) port.
+inline constexpr char kCDPPort[] = "orion-cdp-port";
+
+// Overrides the stable MCP proxy port (what external clients connect to).
+inline constexpr char kProxyPort[] = "orion-proxy-port";
+
+// Overrides the sidecar backend server port.
+inline constexpr char kServerPort[] = "orion-server-port";
+
+// Overrides the Agent server port.
+inline constexpr char kAgentPort[] = "orion-agent-port";
+
+// Overrides the Extension server port.
+inline constexpr char kExtensionPort[] = "orion-extension-port";
+
+// === Extension Switches ===
+
+// Disables Orion managed extensions.
+inline constexpr char kDisableExtensions[] = "disable-orion-extensions";
+
+// Overrides the extensions config URL.
+inline constexpr char kExtensionsUrl[] = "orion-extensions-url";
+
+// === URL Override Switches ===
+
+// Disables chrome://orion/* URL overrides.
+// Useful for debugging to see raw extension URLs.
+inline constexpr char kDisableUrlOverrides[] = "orion-disable-url-overrides";
+
+// === Sparkle Switches (macOS Browser Updates) ===
+
+// Overrides the Sparkle appcast URL for browser updates.
+inline constexpr char kSparkleUrl[] = "orion-sparkle-url";
+
+// Forces an immediate Sparkle update check.
+inline constexpr char kSparkleForceCheck[] = "orion-sparkle-force-check";
+
+// Runs Sparkle in dry-run mode (no actual updates).
+inline constexpr char kSparkleDryRun[] = "sparkle-dry-run";
+
+// Skips Sparkle signature verification (testing only).
+inline constexpr char kSparkleSkipSignature[] = "sparkle-skip-signature";
+
+// Spoofs the current version for Sparkle (testing).
+inline constexpr char kSparkleSpoofVersion[] = "sparkle-spoof-version";
+
+// Enables verbose Sparkle logging.
+inline constexpr char kSparkleVerbose[] = "sparkle-verbose";
+
+// === Misc Switches ===
+
+// Indicates this is the first run of Orion.
+inline constexpr char kFirstRun[] = "orion-welcome";
+
+}  // namespace orion
+
+#endif  // CHROME_BROWSER_ORION_CORE_ORION_SWITCHES_H_
