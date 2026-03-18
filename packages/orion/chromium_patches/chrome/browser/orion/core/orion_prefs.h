diff --git a/chrome/browser/orion/core/orion_prefs.h b/chrome/browser/orion/core/orion_prefs.h
new file mode 100644
index 0000000000000..a94b14e0664ca
--- /dev/null
+++ b/chrome/browser/orion/core/orion_prefs.h
@@ -0,0 +1,86 @@
+// Copyright 2025 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_ORION_CORE_ORION_PREFS_H_
+#define CHROME_BROWSER_ORION_CORE_ORION_PREFS_H_
+
+#include "components/prefs/pref_service.h"
+#include "ui/actions/action_id.h"
+
+namespace user_prefs {
+class PrefRegistrySyncable;
+}  // namespace user_prefs
+
+namespace orion {
+
+namespace prefs {
+
+// Toolbar visibility prefs
+// Boolean: Show LLM Chat in toolbar (default: true)
+inline constexpr char kShowLLMChat[] = "orion.show_llm_chat";
+
+// Boolean: Show LLM Hub in toolbar (default: true)
+inline constexpr char kShowLLMHub[] = "orion.show_llm_hub";
+
+// Boolean: Show labels on Orion toolbar actions (default: true)
+inline constexpr char kShowToolbarLabels[] = "orion.show_toolbar_labels";
+
+// Boolean: Enable vertical tabs (default: true)
+inline constexpr char kVerticalTabsEnabled[] = "orion.vertical_tabs_enabled";
+
+// AI Provider prefs
+// JSON string containing the list of AI providers and configuration
+inline constexpr char kProviders[] = "orion.providers";
+
+// JSON string containing custom AI providers for Orion
+inline constexpr char kCustomProviders[] = "orion.custom_providers";
+
+// String containing the default provider ID for Orion
+inline constexpr char kDefaultProviderId[] = "orion.default_provider_id";
+
+// Boolean: Focus NTP content instead of omnibox on new tab (default: true)
+inline constexpr char kNtpFocusContent[] = "orion.ntp_focus_content";
+
+}  // namespace prefs
+
+// Registers Orion profile preferences.
+void RegisterProfilePrefs(user_prefs::PrefRegistrySyncable* registry);
+
+// Check if LLM Chat should be shown in toolbar.
+bool ShouldShowLLMChat(PrefService* pref_service);
+
+// Check if LLM Hub should be shown in toolbar.
+bool ShouldShowLLMHub(PrefService* pref_service);
+
+// Check if toolbar labels should be shown for Orion actions.
+bool ShouldShowToolbarLabels(PrefService* pref_service);
+
+// Check if vertical tabs should be enabled.
+bool IsVerticalTabsEnabled(PrefService* pref_service);
+
+// Syncs the Orion vertical tabs pref to the upstream Chrome pref.
+// Call this early (e.g. during controller init) so the upstream pref
+// reflects Orion's default.
+void SyncVerticalTabsPref(PrefService* pref_service);
+
+// Sets the default Orion theme (blue tonal spot) on first run
+// when the user hasn't customized the theme yet.
+void SyncDefaultTheme(PrefService* pref_service);
+
+// Check if a toolbar action should be shown based on its visibility pref.
+// Returns true if:
+//   - Action has no visibility pref (e.g., Assistant - always visible)
+//   - Action's visibility pref is true
+// Returns false if action's visibility pref is false.
+bool ShouldShowToolbarAction(actions::ActionId id, PrefService* pref_service);
+
+// Check if NTP content should receive focus instead of the omnibox.
+bool IsNtpFocusContentEnabled(PrefService* pref_service);
+
+// Get the visibility pref key for an action, or nullptr if none exists.
+const char* GetVisibilityPrefForAction(actions::ActionId id);
+
+}  // namespace orion
+
+#endif  // CHROME_BROWSER_ORION_CORE_ORION_PREFS_H_
