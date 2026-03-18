diff --git a/chrome/browser/orion/server/test/mock_implementations.cc b/chrome/browser/orion/server/test/mock_implementations.cc
new file mode 100644
index 0000000000000..3bef12ccf6617
--- /dev/null
+++ b/chrome/browser/orion/server/test/mock_implementations.cc
@@ -0,0 +1,24 @@
+// Copyright 2024 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#include "chrome/browser/orion/server/test/mock_health_checker.h"
+#include "chrome/browser/orion/server/test/mock_process_controller.h"
+#include "chrome/browser/orion/server/test/mock_server_state_store.h"
+#include "chrome/browser/orion/server/test/mock_server_updater.h"
+
+namespace orion {
+
+MockHealthChecker::MockHealthChecker() = default;
+MockHealthChecker::~MockHealthChecker() = default;
+
+MockProcessController::MockProcessController() = default;
+MockProcessController::~MockProcessController() = default;
+
+MockServerStateStore::MockServerStateStore() = default;
+MockServerStateStore::~MockServerStateStore() = default;
+
+MockServerUpdater::MockServerUpdater() = default;
+MockServerUpdater::~MockServerUpdater() = default;
+
+}  // namespace orion
