diff --git a/chrome/utility/importer/orion/chrome_importer.cc b/chrome/utility/importer/orion/chrome_importer.cc
new file mode 100644
index 0000000000000..41dce65dacf4f
--- /dev/null
+++ b/chrome/utility/importer/orion/chrome_importer.cc
@@ -0,0 +1,202 @@
+// Copyright 2023 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#include "chrome/utility/importer/orion/chrome_importer.h"
+
+#include "base/logging.h"
+#include "chrome/common/importer/importer_bridge.h"
+#include "chrome/grit/generated_resources.h"
+#include "chrome/utility/importer/orion/chrome_autofill_importer.h"
+#include "chrome/utility/importer/orion/chrome_bookmarks_importer.h"
+#include "chrome/utility/importer/orion/chrome_cookie_importer.h"
+#include "chrome/utility/importer/orion/chrome_extensions_importer.h"
+#include "chrome/utility/importer/orion/chrome_history_importer.h"
+#include "chrome/utility/importer/orion/chrome_password_importer.h"
+#include "components/user_data_importer/common/importer_data_types.h"
+#include "ui/base/l10n/l10n_util.h"
+
+ChromeImporter::ChromeImporter() = default;
+
+ChromeImporter::~ChromeImporter() = default;
+
+void ChromeImporter::StartImport(
+    const user_data_importer::SourceProfile& source_profile,
+    uint16_t items,
+    ImporterBridge* bridge) {
+  bridge_ = bridge;
+  source_path_ = source_profile.source_path;
+
+  bridge_->NotifyStarted();
+
+  if ((items & user_data_importer::HISTORY) && !cancelled()) {
+    bridge_->NotifyItemStarted(user_data_importer::HISTORY);
+    ImportHistory();
+    bridge_->NotifyItemEnded(user_data_importer::HISTORY);
+  }
+
+  if ((items & user_data_importer::FAVORITES) && !cancelled()) {
+    bridge_->NotifyItemStarted(user_data_importer::FAVORITES);
+    ImportBookmarks();
+    bridge_->NotifyItemEnded(user_data_importer::FAVORITES);
+  }
+
+  if ((items & user_data_importer::PASSWORDS) && !cancelled()) {
+    bridge_->NotifyItemStarted(user_data_importer::PASSWORDS);
+    ImportPasswords();
+    bridge_->NotifyItemEnded(user_data_importer::PASSWORDS);
+  }
+
+  if ((items & user_data_importer::COOKIES) && !cancelled()) {
+    bridge_->NotifyItemStarted(user_data_importer::COOKIES);
+    ImportCookies();
+    bridge_->NotifyItemEnded(user_data_importer::COOKIES);
+  }
+
+  if ((items & user_data_importer::AUTOFILL_FORM_DATA) && !cancelled()) {
+    bridge_->NotifyItemStarted(user_data_importer::AUTOFILL_FORM_DATA);
+    ImportAutofillFormData();
+    bridge_->NotifyItemEnded(user_data_importer::AUTOFILL_FORM_DATA);
+  }
+
+  if ((items & user_data_importer::EXTENSIONS) && !cancelled()) {
+    bridge_->NotifyItemStarted(user_data_importer::EXTENSIONS);
+    ImportExtensions();
+    bridge_->NotifyItemEnded(user_data_importer::EXTENSIONS);
+  }
+
+  bridge_->NotifyEnded();
+}
+
+void ChromeImporter::ImportHistory() {
+  LOG(INFO) << "orion: Starting history import";
+
+  std::vector<user_data_importer::ImporterURLRow> rows =
+      orion_importer::ImportChromeHistory(source_path_);
+
+  if (rows.empty()) {
+    LOG(INFO) << "orion: No history to import";
+    return;
+  }
+
+  LOG(INFO) << "orion: Importing " << rows.size() << " history items";
+
+  if (!cancelled()) {
+    bridge_->SetHistoryItems(rows,
+                             user_data_importer::VISIT_SOURCE_CHROME_IMPORTED);
+  }
+
+  LOG(INFO) << "orion: History import complete";
+}
+
+void ChromeImporter::ImportBookmarks() {
+  LOG(INFO) << "orion: Starting bookmarks import";
+
+  orion_importer::ChromeBookmarksResult result =
+      orion_importer::ImportChromeBookmarks(source_path_);
+
+  if (!result.bookmarks.empty() && !cancelled()) {
+    LOG(INFO) << "orion: Importing " << result.bookmarks.size()
+              << " bookmarks";
+    bridge_->AddBookmarks(result.bookmarks,
+                          l10n_util::GetStringUTF16(IDS_IMPORT_FROM_CHROME));
+  } else {
+    LOG(INFO) << "orion: No bookmarks to import";
+  }
+
+  if (!result.favicons.empty() && !cancelled()) {
+    LOG(INFO) << "orion: Importing " << result.favicons.size()
+              << " favicons";
+    bridge_->SetFavicons(result.favicons);
+  }
+
+  LOG(INFO) << "orion: Bookmarks import complete";
+}
+
+void ChromeImporter::ImportPasswords() {
+  LOG(INFO) << "orion: Starting password import";
+
+  std::vector<user_data_importer::ImportedPasswordForm> passwords =
+      orion_importer::ImportChromePasswords(source_path_);
+
+  if (passwords.empty()) {
+    LOG(INFO) << "orion: No passwords to import";
+    return;
+  }
+
+  LOG(INFO) << "orion: Importing " << passwords.size() << " passwords";
+
+  for (const auto& password : passwords) {
+    if (cancelled()) {
+      break;
+    }
+    bridge_->SetPasswordForm(password);
+  }
+
+  LOG(INFO) << "orion: Password import complete";
+}
+
+void ChromeImporter::ImportCookies() {
+  LOG(INFO) << "orion: Starting cookie import";
+
+  std::vector<orion_importer::ImportedCookieEntry> cookies =
+      orion_importer::ImportChromeCookies(source_path_);
+
+  if (cookies.empty()) {
+    LOG(INFO) << "orion: No cookies to import";
+    return;
+  }
+
+  LOG(INFO) << "orion: Importing " << cookies.size() << " cookies";
+
+  for (const auto& cookie : cookies) {
+    if (cancelled()) {
+      break;
+    }
+    bridge_->SetCookie(cookie);
+  }
+
+  LOG(INFO) << "orion: Cookie import complete";
+}
+
+void ChromeImporter::ImportAutofillFormData() {
+  LOG(INFO) << "orion: Starting autofill import";
+
+  std::vector<ImporterAutofillFormDataEntry> entries =
+      orion_importer::ImportChromeAutofill(source_path_);
+
+  if (entries.empty()) {
+    LOG(INFO) << "orion: No autofill entries to import";
+    return;
+  }
+
+  LOG(INFO) << "orion: Importing " << entries.size()
+            << " autofill entries";
+
+  if (!cancelled()) {
+    bridge_->SetAutofillFormData(entries);
+  }
+
+  LOG(INFO) << "orion: Autofill import complete";
+}
+
+void ChromeImporter::ImportExtensions() {
+  LOG(INFO) << "orion: Starting extensions import";
+
+  std::vector<std::string> extension_ids =
+      orion_importer::ImportChromeExtensions(source_path_);
+
+  if (extension_ids.empty()) {
+    LOG(INFO) << "orion: No extensions to import";
+    return;
+  }
+
+  LOG(INFO) << "orion: Importing " << extension_ids.size()
+            << " extensions";
+
+  if (!cancelled()) {
+    bridge_->SetExtensions(extension_ids);
+  }
+
+  LOG(INFO) << "orion: Extensions import complete";
+}
