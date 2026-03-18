diff --git a/chrome/browser/extensions/api/browser_os/browser_os_api.h b/chrome/browser/extensions/api/browser_os/browser_os_api.h
new file mode 100644
index 0000000000000..53ece24723da0
--- /dev/null
+++ b/chrome/browser/extensions/api/browser_os/browser_os_api.h
@@ -0,0 +1,371 @@
+// Copyright 2024 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_EXTENSIONS_API_BROWSER_OS_BROWSER_OS_API_H_
+#define CHROME_BROWSER_EXTENSIONS_API_BROWSER_OS_BROWSER_OS_API_H_
+
+#include <cstdint>
+
+#include "base/memory/weak_ptr.h"
+#include "base/values.h"
+#include "chrome/browser/extensions/api/browser_os/browser_os_api_utils.h"
+#include "chrome/browser/extensions/api/browser_os/browser_os_content_processor.h"
+#include "chrome/browser/extensions/api/browser_os/browser_os_snapshot_processor.h"
+#include "components/viz/common/frame_sinks/copy_output_result.h"
+#include "content/public/browser/render_widget_host_view.h"
+#include "extensions/browser/extension_function.h"
+#include "third_party/skia/include/core/SkBitmap.h"
+#include "ui/shell_dialogs/select_file_dialog.h"
+
+namespace content {
+class WebContents;
+}
+
+namespace ui {
+struct AXTreeUpdate;
+}
+
+namespace extensions {
+namespace api {
+
+
+class OrionGetAccessibilityTreeFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.getAccessibilityTree",
+                             BROWSER_OS_GETACCESSIBILITYTREE)
+
+  OrionGetAccessibilityTreeFunction() = default;
+
+ protected:
+  ~OrionGetAccessibilityTreeFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+
+ private:
+  void OnAccessibilityTreeReceived(ui::AXTreeUpdate& tree_update);
+};
+
+class OrionGetInteractiveSnapshotFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.getInteractiveSnapshot",
+                             BROWSER_OS_GETINTERACTIVESNAPSHOT)
+
+  OrionGetInteractiveSnapshotFunction();
+
+ protected:
+  ~OrionGetInteractiveSnapshotFunction() override;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+
+ private:
+  void OnAccessibilityTreeReceived(ui::AXTreeUpdate& tree_update);
+  void OnSnapshotProcessed(SnapshotProcessingResult result);
+  
+  // Counter for snapshot IDs
+  static uint32_t next_snapshot_id_;
+  
+  // Tab ID for storing mappings
+  int tab_id_ = -1;
+  
+  // Web contents for processing and drawing
+  base::WeakPtr<content::WebContents> web_contents_;
+};
+
+class OrionClickFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.click", BROWSER_OS_CLICK)
+
+  OrionClickFunction() = default;
+
+ protected:
+  ~OrionClickFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+};
+
+class OrionInputTextFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.inputText", BROWSER_OS_INPUTTEXT)
+
+  OrionInputTextFunction() = default;
+
+ protected:
+  ~OrionInputTextFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+};
+
+class OrionClearFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.clear", BROWSER_OS_CLEAR)
+
+  OrionClearFunction() = default;
+
+ protected:
+  ~OrionClearFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+};
+
+class OrionGetPageLoadStatusFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.getPageLoadStatus", 
+                             BROWSER_OS_GETPAGELOADSTATUS)
+
+  OrionGetPageLoadStatusFunction() = default;
+
+ protected:
+  ~OrionGetPageLoadStatusFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+};
+
+class OrionScrollUpFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.scrollUp", BROWSER_OS_SCROLLUP)
+
+  OrionScrollUpFunction() = default;
+
+ protected:
+  ~OrionScrollUpFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+};
+
+class OrionScrollDownFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.scrollDown", BROWSER_OS_SCROLLDOWN)
+
+  OrionScrollDownFunction() = default;
+
+ protected:
+  ~OrionScrollDownFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+};
+
+class OrionScrollToNodeFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.scrollToNode", BROWSER_OS_SCROLLTONODE)
+
+  OrionScrollToNodeFunction() = default;
+
+ protected:
+  ~OrionScrollToNodeFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+};
+
+class OrionSendKeysFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.sendKeys", BROWSER_OS_SENDKEYS)
+
+  OrionSendKeysFunction() = default;
+
+ protected:
+  ~OrionSendKeysFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+};
+
+class OrionCaptureScreenshotFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.captureScreenshot", BROWSER_OS_CAPTURESCREENSHOT)
+
+  OrionCaptureScreenshotFunction();
+
+ protected:
+  ~OrionCaptureScreenshotFunction() override;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+  
+ private:
+  void DrawHighlightsAndCapture();
+  void CaptureScreenshotNow();
+  void OnScreenshotCaptured(const content::CopyFromSurfaceResult& result);
+  
+  // Store web contents and tab id for highlight operations
+  base::WeakPtr<content::WebContents> web_contents_;
+  int tab_id_ = -1;
+  gfx::Size target_size_;
+  bool show_highlights_ = false;
+  bool use_exact_dimensions_ = false;
+};
+
+class OrionGetSnapshotFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.getSnapshot", BROWSER_OS_GETSNAPSHOT)
+
+  OrionGetSnapshotFunction() = default;
+
+ protected:
+  ~OrionGetSnapshotFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+
+ private:
+  void OnAccessibilityTreeReceived(ui::AXTreeUpdate& tree_update);
+};
+
+// Settings API functions
+class OrionGetPrefFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.getPref", BROWSER_OS_GETPREF)
+
+  OrionGetPrefFunction() = default;
+
+ protected:
+  ~OrionGetPrefFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+};
+
+class OrionSetPrefFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.setPref", BROWSER_OS_SETPREF)
+
+  OrionSetPrefFunction() = default;
+
+ protected:
+  ~OrionSetPrefFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+};
+
+class OrionGetAllPrefsFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.getAllPrefs", BROWSER_OS_GETALLPREFS)
+
+  OrionGetAllPrefsFunction() = default;
+
+ protected:
+  ~OrionGetAllPrefsFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+};
+
+class OrionLogMetricFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.logMetric", BROWSER_OS_LOGMETRIC)
+
+  OrionLogMetricFunction() = default;
+
+ protected:
+  ~OrionLogMetricFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+};
+
+class OrionGetVersionNumberFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.getVersionNumber", BROWSER_OS_GETVERSIONNUMBER)
+
+  OrionGetVersionNumberFunction() = default;
+
+ protected:
+  ~OrionGetVersionNumberFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+};
+
+class OrionGetBrowserosVersionNumberFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.getBrowserosVersionNumber", BROWSER_OS_GETORIONVERSIONNUMBER)
+
+  OrionGetBrowserosVersionNumberFunction() = default;
+
+ protected:
+  ~OrionGetBrowserosVersionNumberFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+};
+
+class OrionExecuteJavaScriptFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.executeJavaScript", BROWSER_OS_EXECUTEJAVASCRIPT)
+
+  OrionExecuteJavaScriptFunction() = default;
+
+ protected:
+  ~OrionExecuteJavaScriptFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+  
+ private:
+  void OnJavaScriptExecuted(base::Value result);
+};
+
+class OrionClickCoordinatesFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.clickCoordinates", BROWSER_OS_CLICKCOORDINATES)
+
+  OrionClickCoordinatesFunction() = default;
+
+ protected:
+  ~OrionClickCoordinatesFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+};
+
+class OrionTypeAtCoordinatesFunction : public ExtensionFunction {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.typeAtCoordinates", BROWSER_OS_TYPEATCOORDINATES)
+
+  OrionTypeAtCoordinatesFunction() = default;
+
+ protected:
+  ~OrionTypeAtCoordinatesFunction() override = default;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+};
+
+class OrionChoosePathFunction : public ExtensionFunction,
+                                    public ui::SelectFileDialog::Listener {
+ public:
+  DECLARE_EXTENSION_FUNCTION("browserOS.choosePath", BROWSER_OS_CHOOSEPATH)
+
+  OrionChoosePathFunction();
+  OrionChoosePathFunction(const OrionChoosePathFunction&) = delete;
+  OrionChoosePathFunction& operator=(const OrionChoosePathFunction&) =
+      delete;
+
+  // ui::SelectFileDialog::Listener:
+  void FileSelected(const ui::SelectedFileInfo& file, int index) override;
+  void FileSelectionCanceled() override;
+
+ protected:
+  ~OrionChoosePathFunction() override;
+
+  // ExtensionFunction:
+  ResponseAction Run() override;
+
+ private:
+  scoped_refptr<ui::SelectFileDialog> select_file_dialog_;
+};
+
+}  // namespace api
+}  // namespace extensions
+
+#endif  // CHROME_BROWSER_EXTENSIONS_API_BROWSER_OS_BROWSER_OS_API_H_
