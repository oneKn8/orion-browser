/**
 * @license
 * Copyright 2025 Orion
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Centralized file system paths.
 */

export const PATHS = {
  DEFAULT_EXECUTION_DIR: process.cwd(),
  ORION_DIR_NAME: '.orion',
  MEMORY_DIR_NAME: 'memory',
  SESSIONS_DIR_NAME: 'sessions',
  TOOL_OUTPUT_DIR_NAME: 'tool-output',
  SOUL_FILE_NAME: 'SOUL.md',
  CORE_MEMORY_FILE_NAME: 'CORE.md',
  SKILLS_DIR_NAME: 'skills',
  SOUL_MAX_LINES: 150,
  MEMORY_RETENTION_DAYS: 30,
  SESSION_RETENTION_DAYS: 30,
} as const
