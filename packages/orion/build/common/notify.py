#!/usr/bin/env python3
"""Notification system for Orion build pipeline"""

import os
import threading
from typing import Optional, Dict, Any

# Slack attachment colors
COLOR_BLUE = "#2196F3"
COLOR_GREEN = "#4CAF50"
COLOR_RED = "#F44336"

# Build context (set once at pipeline start)
_build_context: Dict[str, str] = {}


def set_build_context(os_name: str, arch: str) -> None:
    """Set build context for all notifications"""
    _build_context["os"] = os_name
    _build_context["arch"] = arch


def _get_context_prefix() -> str:
    """Get [arch] prefix if context is set"""
    if "arch" in _build_context:
        return f"[{_build_context['arch']}] "
    return ""


def _get_context_footer() -> str:
    """Get OS footer if context is set"""
    if "os" in _build_context:
        return f"Orion Build System - {_build_context['os']}"
    return "Orion Build System"


class Notifier:
    """Fire-and-forget notification system"""

    def __init__(self):
        self.slack_webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
        self.enabled = bool(self.slack_webhook_url)

    def notify(self, event: str, message: str, details: Optional[Dict[str, Any]] = None, color: str = "#36a64f") -> None:
        """Send notification asynchronously (fire-and-forget)"""
        if not self.enabled:
            return

        # Fire and forget - run in background thread
        thread = threading.Thread(
            target=self._send_notification,
            args=(event, message, details, color),
            daemon=True
        )
        thread.start()

    def _send_notification(self, event: str, message: str, details: Optional[Dict[str, Any]], color: str) -> None:
        """Internal method to send notification (runs in background thread)"""
        try:
            import requests

            # Build footer text
            footer = f"🍎 {_get_context_footer()}" if _build_context.get("os") == "macOS" \
                else f"🪟 {_get_context_footer()}" if _build_context.get("os") == "Windows" \
                else f"🐧 {_get_context_footer()}" if _build_context.get("os") == "Linux" \
                else _get_context_footer()

            # Use legacy attachment format for colored sidebar
            attachment = {
                "color": color,
                "mrkdwn_in": ["text", "fields"],
                "text": f"*{event}*\n{message}",
                "footer": footer
            }

            if details:
                attachment["fields"] = [
                    {"title": key, "value": str(value), "short": True}
                    for key, value in details.items()
                ]

            payload = {"attachments": [attachment]}

            requests.post(
                self.slack_webhook_url,
                json=payload,
                timeout=5  # Quick timeout for fire-and-forget
            )

        except ImportError:
            pass
        except Exception:
            pass


# Global notifier instance
_notifier = None


def get_notifier() -> Notifier:
    """Get global notifier instance"""
    global _notifier
    if _notifier is None:
        _notifier = Notifier()
    return _notifier


def notify_pipeline_start(pipeline_name: str, modules: list) -> None:
    """Notify that pipeline has started"""
    notifier = get_notifier()
    notifier.notify(
        "🚀 Pipeline Started",
        "Build pipeline started",
        {"Modules": ", ".join(modules)},
        color=COLOR_BLUE
    )


def notify_pipeline_end(pipeline_name: str, duration: float) -> None:
    """Notify that pipeline completed successfully"""
    notifier = get_notifier()
    mins = int(duration / 60)
    secs = int(duration % 60)
    notifier.notify(
        "🏁 Pipeline Completed",
        "Build pipeline completed successfully",
        {"Duration": f"{mins}m {secs}s"},
        color=COLOR_GREEN
    )


def notify_pipeline_error(pipeline_name: str, error: str) -> None:
    """Notify that pipeline failed with error"""
    notifier = get_notifier()
    notifier.notify(
        "❌ Pipeline Failed",
        "Build pipeline failed",
        {"Error": error},
        color=COLOR_RED
    )


def notify_module_start(module_name: str) -> None:
    """Notify that a module started executing"""
    notifier = get_notifier()
    prefix = _get_context_prefix()
    notifier.notify(
        "▶️ Module Started",
        f"{prefix}Module '{module_name}' started",
        None,
        color=COLOR_BLUE
    )


def notify_module_completion(module_name: str, duration: float) -> None:
    """Notify that a module completed successfully"""
    notifier = get_notifier()
    prefix = _get_context_prefix()
    notifier.notify(
        "✅ Module Completed",
        f"{prefix}Module '{module_name}' completed",
        {"Duration": f"{duration:.1f}s"},
        color=COLOR_GREEN
    )
