diff --git a/chrome/browser/extensions/external_provider_impl.cc b/chrome/browser/extensions/external_provider_impl.cc
index 9c8731d3ed4ab..976cd2b21e42b 100644
--- a/chrome/browser/extensions/external_provider_impl.cc
+++ b/chrome/browser/extensions/external_provider_impl.cc
@@ -30,6 +30,8 @@
 #include "chrome/browser/browser_features.h"
 #include "chrome/browser/browser_process.h"
 #include "chrome/browser/browser_process_platform_part.h"
+#include "chrome/browser/orion/core/orion_switches.h"
+#include "chrome/browser/orion/extensions/orion_extension_loader.h"
 #include "chrome/browser/extensions/extension_management.h"
 #include "chrome/browser/extensions/extension_migrator.h"
 #include "chrome/browser/extensions/external_component_loader.h"
@@ -915,6 +917,40 @@ void ExternalProviderImpl::CreateExternalProviders(
     provider_list->push_back(std::move(initial_external_extensions_provider));
   }
 #endif  // BUILDFLAG(ENABLE_EXTENSIONS)
+
+  // Add Orion external extension loader
+  // This loader supports both bundled CRX files (for immediate install) and
+  // remote configuration (for updates). Bundled extensions are tried first.
+  auto orion_loader =
+      base::MakeRefCounted<orion::OrionExtensionLoader>(profile);
+
+  // Allow custom config URL via command line
+  if (base::CommandLine::ForCurrentProcess()->HasSwitch(
+          orion::kExtensionsUrl)) {
+    std::string config_url =
+        base::CommandLine::ForCurrentProcess()->GetSwitchValueASCII(
+            orion::kExtensionsUrl);
+    GURL url(config_url);
+    if (url.is_valid()) {
+      orion_loader->SetConfigUrl(url);
+    }
+  }
+
+  // Allow disabling via command line flag if needed
+  if (!base::CommandLine::ForCurrentProcess()->HasSwitch(
+          orion::kDisableExtensions)) {
+    // Use kExternalComponent for all Orion extensions - higher privilege
+    // level, consistent location for both bundled CRX and remote URL installs.
+    auto orion_provider = std::make_unique<ExternalProviderImpl>(
+        service, orion_loader, profile,
+        ManifestLocation::kExternalComponent,  // CRX location (bundled)
+        ManifestLocation::kExternalComponent,  // Download location (remote)
+        Extension::WAS_INSTALLED_BY_DEFAULT);
+    orion_provider->set_auto_acknowledge(true);
+    orion_provider->set_allow_updates(true);
+    orion_provider->set_install_immediately(true);
+    provider_list->push_back(std::move(orion_provider));
+  }
 }
 
 }  // namespace extensions
