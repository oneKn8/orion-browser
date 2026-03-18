diff --git a/chrome/browser/orion/core/orion_action_utils.h b/chrome/browser/orion/core/orion_action_utils.h
new file mode 100644
index 0000000000000..0adfaa4a8ac83
--- /dev/null
+++ b/chrome/browser/orion/core/orion_action_utils.h
@@ -0,0 +1,70 @@
+// Copyright 2025 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_ORION_CORE_ORION_ACTION_UTILS_H_
+#define CHROME_BROWSER_ORION_CORE_ORION_ACTION_UTILS_H_
+
+#include <string>
+#include <string_view>
+
+#include "base/containers/fixed_flat_set.h"
+#include "chrome/browser/orion/core/orion_constants.h"
+#include "chrome/browser/ui/actions/chrome_action_id.h"
+#include "chrome/browser/ui/ui_features.h"
+#include "chrome/browser/ui/views/side_panel/side_panel_entry_key.h"
+#include "chrome/common/chrome_features.h"
+#include "ui/actions/actions.h"
+
+namespace orion {
+
+// Native action IDs for Orion panels that need special treatment.
+// These actions will:
+// - Always be pinned (unless disabled via pref)
+// - Show text labels (when enabled via pref)
+// - Have high flex priority (always visible)
+constexpr auto kOrionNativeActionIds =
+    base::MakeFixedFlatSet<actions::ActionId>({
+        kActionSidePanelShowThirdPartyLlm,
+        kActionSidePanelShowClashOfGpts,
+        kActionOrionAgent,
+    });
+
+// Check if an action ID is a Orion action (native or extension).
+inline bool IsOrionAction(actions::ActionId id) {
+  // Check native actions
+  if (kOrionNativeActionIds.contains(id)) {
+    return true;
+  }
+
+  // Only labelled extensions are considered for Orion actions
+  for (const auto& ext_id : orion::GetOrionExtensionIds()) {
+    if (!orion::IsOrionLabelledExtension(ext_id)) {
+      continue;
+    }
+    auto ext_action_id = actions::ActionIdMap::StringToActionId(
+        SidePanelEntryKey(SidePanelEntryId::kExtension, ext_id).ToString());
+    if (ext_action_id && id == *ext_action_id) {
+      return true;
+    }
+  }
+
+  return false;
+}
+
+// Get the feature flag for a native Orion action.
+inline const base::Feature* GetFeatureForOrionAction(
+    actions::ActionId id) {
+  switch (id) {
+    case kActionSidePanelShowThirdPartyLlm:
+      return &features::kThirdPartyLlmPanel;
+    case kActionSidePanelShowClashOfGpts:
+      return &features::kClashOfGpts;
+    default:
+      return nullptr;
+  }
+}
+
+}  // namespace orion
+
+#endif  // CHROME_BROWSER_ORION_CORE_ORION_ACTION_UTILS_H_
