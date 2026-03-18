diff --git a/chrome/browser/orion/metrics/orion_metrics_service_factory.h b/chrome/browser/orion/metrics/orion_metrics_service_factory.h
new file mode 100644
index 0000000000000..2caddc7598a43
--- /dev/null
+++ b/chrome/browser/orion/metrics/orion_metrics_service_factory.h
@@ -0,0 +1,48 @@
+// Copyright 2025 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_ORION_METRICS_ORION_METRICS_SERVICE_FACTORY_H_
+#define CHROME_BROWSER_ORION_METRICS_ORION_METRICS_SERVICE_FACTORY_H_
+
+#include "base/no_destructor.h"
+#include "components/keyed_service/content/browser_context_keyed_service_factory.h"
+
+namespace content {
+class BrowserContext;
+}  // namespace content
+
+namespace orion_metrics {
+
+class OrionMetricsService;
+
+// Factory for creating OrionMetricsService instances per profile.
+class OrionMetricsServiceFactory
+    : public BrowserContextKeyedServiceFactory {
+ public:
+  OrionMetricsServiceFactory(const OrionMetricsServiceFactory&) =
+      delete;
+  OrionMetricsServiceFactory& operator=(
+      const OrionMetricsServiceFactory&) = delete;
+
+  // Returns the OrionMetricsService for |context|, creating one if needed.
+  static OrionMetricsService* GetForBrowserContext(
+      content::BrowserContext* context);
+
+  // Returns the singleton factory instance.
+  static OrionMetricsServiceFactory* GetInstance();
+
+ private:
+  friend base::NoDestructor<OrionMetricsServiceFactory>;
+
+  OrionMetricsServiceFactory();
+  ~OrionMetricsServiceFactory() override;
+
+  // BrowserContextKeyedServiceFactory:
+  std::unique_ptr<KeyedService> BuildServiceInstanceForBrowserContext(
+      content::BrowserContext* context) const override;
+};
+
+}  // namespace orion_metrics
+
+#endif  // CHROME_BROWSER_ORION_METRICS_ORION_METRICS_SERVICE_FACTORY_H_
