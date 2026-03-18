/** @public */
export const ORION_PREFS = {
  AGENT_PORT: 'orion.server.agent_port',
  MCP_PORT: 'orion.server.mcp_port',
  PROVIDERS: 'orion.providers',
  THIRD_PARTY_LLM_PROVIDERS: 'orion.third_party_llm.providers',
  PROXY_PORT: 'orion.server.proxy_port',
  SERVER_PORT: 'orion.server.server_port',
  ALLOW_REMOTE_MCP: 'orion.server.allow_remote_in_mcp',
  RESTART_SERVER: 'orion.server.restart_requested',
  SHOW_LLM_CHAT: 'orion.show_llm_chat',
  SHOW_LLM_HUB: 'orion.show_llm_hub',
  SHOW_TOOLBAR_LABELS: 'orion.show_toolbar_labels',
  VERTICAL_TABS_ENABLED: 'orion.vertical_tabs_enabled',
  INSTALL_ID: 'orion.metrics_install_id',
} as const
