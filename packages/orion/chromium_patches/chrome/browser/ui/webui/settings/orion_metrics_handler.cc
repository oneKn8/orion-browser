diff --git a/chrome/browser/ui/webui/settings/orion_metrics_handler.cc b/chrome/browser/ui/webui/settings/orion_metrics_handler.cc
new file mode 100644
index 0000000000000..d043fcba5a32c
--- /dev/null
+++ b/chrome/browser/ui/webui/settings/orion_metrics_handler.cc
@@ -0,0 +1,56 @@
+// Copyright 2025 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#include "chrome/browser/ui/webui/settings/orion_metrics_handler.h"
+
+#include "base/logging.h"
+#include "base/values.h"
+#include "chrome/browser/orion/metrics/orion_metrics.h"
+
+namespace settings {
+
+OrionMetricsHandler::OrionMetricsHandler() = default;
+
+OrionMetricsHandler::~OrionMetricsHandler() = default;
+
+void OrionMetricsHandler::RegisterMessages() {
+  web_ui()->RegisterMessageCallback(
+      "logOrionMetric",
+      base::BindRepeating(&OrionMetricsHandler::HandleLogOrionMetric,
+                         base::Unretained(this)));
+}
+
+void OrionMetricsHandler::HandleLogOrionMetric(
+    const base::ListValue& args) {
+  if (args.size() < 1 || !args[0].is_string()) {
+    LOG(WARNING) << "orion: Invalid metric event name";
+    return;
+  }
+
+  const std::string& event_name = args[0].GetString();
+  
+  if (args.size() > 1) {
+    // Has properties
+    if (args[1].is_dict()) {
+      base::DictValue properties = args[1].GetDict().Clone();
+      orion_metrics::OrionMetrics::Log(event_name, std::move(properties));
+    } else {
+      LOG(WARNING) << "orion: Invalid metric properties format";
+      orion_metrics::OrionMetrics::Log(event_name);
+    }
+  } else {
+    // No properties
+    orion_metrics::OrionMetrics::Log(event_name);
+  }
+}
+
+void OrionMetricsHandler::OnJavascriptAllowed() {
+  // No special setup needed
+}
+
+void OrionMetricsHandler::OnJavascriptDisallowed() {
+  // No cleanup needed
+}
+
+}  // namespace settings
\ No newline at end of file
