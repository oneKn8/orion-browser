diff --git a/chrome/browser/orion/server/orion_server_manager.h b/chrome/browser/orion/server/orion_server_manager.h
new file mode 100644
index 0000000000000..241343e436f94
--- /dev/null
+++ b/chrome/browser/orion/server/orion_server_manager.h
@@ -0,0 +1,158 @@
+// Copyright 2024 The Chromium Authors
+// Use of this source code is governed by a BSD-style license that can be
+// found in the LICENSE file.
+
+#ifndef CHROME_BROWSER_ORION_SERVER_ORION_SERVER_MANAGER_H_
+#define CHROME_BROWSER_ORION_SERVER_ORION_SERVER_MANAGER_H_
+
+#include <memory>
+#include <set>
+
+#include "base/files/file.h"
+#include "base/files/file_path.h"
+#include "base/memory/raw_ptr.h"
+#include "base/memory/weak_ptr.h"
+#include "base/no_destructor.h"
+#include "base/process/process.h"
+#include "base/timer/timer.h"
+#include "chrome/browser/orion/server/orion_server_config.h"
+#include "chrome/browser/orion/server/process_controller.h"
+
+class PrefChangeRegistrar;
+class PrefService;
+
+namespace orion_server {
+class OrionServerUpdater;
+}
+
+namespace orion {
+class OrionServerProxy;
+class HealthChecker;
+class ProcessController;
+class ServerStateStore;
+class ServerUpdater;
+}
+
+namespace orion {
+
+// Orion: Manages the lifecycle of the Orion server process (singleton)
+// This manager:
+// 1. Starts Chromium's CDP WebSocket server
+// 2. Binds a stable MCP proxy port that forwards /mcp to the sidecar
+// 3. Launches the bundled Orion server binary with ephemeral backend ports
+// 4. Monitors server health via HTTP /health endpoint and auto-restarts
+class OrionServerManager {
+ public:
+  // Production singleton (uses real implementations)
+  static OrionServerManager* GetInstance();
+
+  // Test constructor (dependency injection)
+  OrionServerManager(std::unique_ptr<ProcessController> process_controller,
+                         std::unique_ptr<ServerStateStore> state_store,
+                         std::unique_ptr<HealthChecker> health_checker,
+                         std::unique_ptr<ServerUpdater> updater,
+                         PrefService* local_state);
+
+  OrionServerManager(const OrionServerManager&) = delete;
+  OrionServerManager& operator=(const OrionServerManager&) = delete;
+
+  void Start();
+  void Stop();
+  bool IsRunning() const;
+
+  // Returns the stable MCP proxy port (what external clients connect to)
+  int GetMCPPort() const { return ports_.proxy; }
+  int GetProxyPort() const { return ports_.proxy; }
+
+  int GetCDPPort() const { return ports_.cdp; }
+  int GetExtensionPort() const { return ports_.extension; }
+  int GetServerPort() const { return ports_.server; }
+
+  const ServerPorts& GetPorts() const { return ports_; }
+
+  bool IsAllowRemoteInMCP() const { return allow_remote_in_mcp_; }
+
+  void Shutdown();
+
+  // Health check result handler (public for testing)
+  void OnHealthCheckComplete(bool success);
+
+  void SetRunningForTesting(bool running) { is_running_ = running; }
+
+  base::FilePath GetOrionServerExecutablePath() const;
+  base::FilePath GetOrionServerResourcesPath() const;
+
+  using UpdateCompleteCallback = base::OnceCallback<void(bool success)>;
+  void RestartServerForUpdate(UpdateCompleteCallback callback);
+
+ private:
+  friend base::NoDestructor<OrionServerManager>;
+
+  OrionServerManager();
+  ~OrionServerManager();
+
+  bool AcquireLock();
+  bool RecoverFromOrphan();
+
+  void LoadPortsFromPrefs();
+  void SetupPrefObservers();
+  void ResolvePortsForStartup();
+  void ApplyCommandLineOverrides();
+  void SavePortsToPrefs();
+  void StartCDPServer();
+  void StopCDPServer();
+  void StartProxy();
+  void StopProxy();
+
+  ServerLaunchConfig BuildLaunchConfig();
+
+  void LaunchOrionProcess();
+  void OnProcessLaunched(LaunchResult result);
+
+  void TerminateOrionProcess(base::OnceCallback<void()> callback);
+  void OnTerminateHttpComplete(base::OnceCallback<void()> callback,
+                               bool http_success);
+
+  void RestartOrionProcess();
+  void ContinueRestartAfterTerminate();
+  void ContinueUpdateAfterTerminate();
+
+  void OnProcessExited(int exit_code);
+  void CheckServerHealth();
+  void OnAllowRemoteInMCPChanged();
+  void OnRestartServerRequestedChanged();
+  void CheckProcessStatus();
+
+  base::FilePath GetOrionExecutionDir() const;
+
+  std::unique_ptr<ProcessController> process_controller_;
+  std::unique_ptr<ServerStateStore> state_store_;
+  std::unique_ptr<HealthChecker> health_checker_;
+  std::unique_ptr<OrionServerProxy> server_proxy_;
+
+  raw_ptr<PrefService> local_state_ = nullptr;
+
+  base::File lock_file_;
+  base::Process process_;
+  ServerPorts ports_;
+  bool allow_remote_in_mcp_ = false;
+  bool is_running_ = false;
+  bool is_restarting_ = false;
+  bool is_updating_ = false;
+  UpdateCompleteCallback update_complete_callback_;
+
+  int consecutive_startup_failures_ = 0;
+  base::TimeTicks last_launch_time_;
+
+  base::RepeatingTimer health_check_timer_;
+  base::RepeatingTimer process_check_timer_;
+
+  std::unique_ptr<PrefChangeRegistrar> pref_change_registrar_;
+  std::unique_ptr<ServerUpdater> updater_;
+
+  base::WeakPtrFactory<OrionServerManager> weak_factory_{this};
+};
+
+}  // namespace orion
+
+#endif  // CHROME_BROWSER_ORION_SERVER_ORION_SERVER_MANAGER_H_
