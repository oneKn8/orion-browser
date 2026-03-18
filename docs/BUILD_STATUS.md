# Orion Browser Build Status

## Chromium Source
- Version: 146.0.7680.31
- Location: /home/oneknight/chromium/src
- Size: ~88GB (source + deps)
- Status: Checked out and synced

## Patch Application (2026-03-18)
- Total patches: 321
- Applied successfully: 291 (91%)
- Failed: 30 (9%)

### Failed Patches (need manual resolution)

BUILD.gn conflicts (build system):
- chrome/BUILD.gn
- chrome/browser/BUILD.gn
- chrome/browser/ui/tabs/BUILD.gn
- chrome/test/BUILD.gn

Missing files (removed/refactored in Chromium 146):
- chrome/browser/extensions/extension_web_ui_override_registrar.cc
- chrome/browser/ui/views/side_panel/side_panel_action_callback.cc
- chrome/browser/ui/views/side_panel/side_panel_action_callback.h
- chrome/browser/ui/views/side_panel/side_panel_entry_id.h
- chrome/browser/ui/views/side_panel/side_panel_prefs.cc
- chrome/browser/ui/views/side_panel/side_panel_util.cc

Merge conflicts (code shifted):
- chrome/browser/flag_descriptions.h
- chrome/browser/media/extension_media_access_handler.cc
- chrome/browser/metrics/chrome_metrics_service_client.cc
- chrome/browser/sync/prefs/chrome_syncable_prefs_database.cc
- chrome/browser/themes/theme_service.cc
- chrome/browser/ui/actions/chrome_action_id.h
- chrome/browser/ui/browser_actions.cc
- chrome/browser/ui/browser_command_controller.cc
- chrome/browser/ui/browser_window/internal/browser_window_features.cc
- chrome/browser/ui/browser_window/public/browser_window_features.h
- chrome/browser/ui/extensions/settings_overridden_params_providers.cc
- chrome/browser/ui/omnibox/chrome_omnibox_client.cc
- chrome/browser/ui/tabs/features.cc
- chrome/browser/ui/tabs/vertical_tab_strip_state_controller.cc
- chrome/browser/ui/views/side_panel/extensions/extension_side_panel_manager.cc
- chrome/browser/ui/views/toolbar/pinned_toolbar_actions_container.cc
- chrome/browser/ui/webui/settings/settings_ui.cc
- chrome/common/pref_names.h
- components/infobars/core/infobar_delegate.h
- tools/metrics/histograms/metadata/browser/enums.xml

### Resolution Strategy
These patches were created for BrowserOS which may target a slightly different Chromium commit.
To resolve:
1. Check BrowserOS BASE_COMMIT for exact Chromium revision
2. Apply patches to that exact revision instead of the tag
3. Or manually resolve conflicts for each failed patch

### Successfully Applied Features
- Orion core infrastructure (constants, prefs, switches)
- Branding (version, strings, icons)
- Server integration (full server manager, updater, proxy)
- Metrics system
- Extension API (browserOS permission, side panel)
- Extension OTA updater
- Chrome importer
- Settings page
- DevTools protocol extensions (Bookmarks, History, Browser domains)
- LLM chat side panel
- LLM hub (Clash of GPTs)
- Pin chat and hub to toolbar
- Keyboard shortcuts
- Sparkle updater (macOS)
- UI fixes and patches
