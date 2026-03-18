diff --git a/chrome/browser/orion/server/orion_server_prefs.h b/chrome/browser/orion/server/orion_server_prefs.h
new file mode 100644
index 0000000000000..69bd172f9ce25
--- /dev/null
+++ b/chrome/browser/orion/server/orion_server_prefs.h
@@ -0,0 +1,36 @@
+// Copyright 2024 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_ORION_SERVER_ORION_SERVER_PREFS_H_
+#define CHROME_BROWSER_ORION_SERVER_ORION_SERVER_PREFS_H_
+
+class PrefRegistrySimple;
+
+namespace orion_server {
+
+// Default port values for Orion server
+inline constexpr int kDefaultCDPPort = 9100;
+inline constexpr int kDefaultProxyPort = 9000;
+inline constexpr int kDefaultServerPort = 9200;
+inline constexpr int kDefaultExtensionPort = 9300;
+
+// Preference keys for Orion server configuration
+extern const char kCDPServerPort[];
+extern const char kProxyPort[];
+extern const char kServerPort[];
+extern const char kExtensionServerPort[];
+extern const char kAllowRemoteInMCP[];
+extern const char kRestartServerRequested[];
+extern const char kServerVersion[];
+
+// Deprecated prefs (kept for migration, will be removed in future)
+extern const char kMCPServerPort[];       // DEPRECATED: migrated to kProxyPort
+extern const char kMCPServerEnabled[];    // DEPRECATED: no longer used
+
+// Registers Orion server preferences in Local State (browser-wide prefs)
+void RegisterLocalStatePrefs(PrefRegistrySimple* registry);
+
+}  // namespace orion_server
+
+#endif  // CHROME_BROWSER_ORION_SERVER_ORION_SERVER_PREFS_H_
