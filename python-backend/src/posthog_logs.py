"""Dedicated PostHog OTLP log exporter for the Python Worker."""

import atexit
import logging
import os

from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor


POSTHOG_PROJECT_TOKEN = os.getenv("POSTHOG_PROJECT_TOKEN")
POSTHOG_HOST = os.getenv("POSTHOG_HOST")
posthog_log_logger = logging.getLogger("posthog.exporter")
posthog_log_logger.propagate = False


def _initialize_posthog_logs():
    """Attach an OTLP handler only to log lines created by this integration."""
    if not POSTHOG_PROJECT_TOKEN or not POSTHOG_HOST:
        return None

    logger_provider = LoggerProvider()
    exporter = OTLPLogExporter(
        endpoint=f"{POSTHOG_HOST.rstrip('/')}/i/v1/logs",
        headers={"Authorization": f"Bearer {POSTHOG_PROJECT_TOKEN}"},
        timeout=3,
    )
    logger_provider.add_log_record_processor(BatchLogRecordProcessor(exporter))
    posthog_log_logger.addHandler(LoggingHandler(logger_provider=logger_provider))
    posthog_log_logger.setLevel(logging.INFO)
    return logger_provider


def log_round_completed(round_data):
    """Export the safe outcome metadata for a completed game round."""
    try:
        posthog_log_logger.info(
            "game round completed",
            extra={
                "log_event": "game_round_completed",
                "round_result": round_data["result"],
                "difficulty": round_data["level"],
                "game_variant": round_data["variant"],
                "round_number": round_data["telemetry"]["rounds"],
            },
        )
    except Exception:
        pass


def log_request_failure(error):
    """Export failure type without serializing a request or exception details."""
    try:
        posthog_log_logger.error(
            "game request failed",
            extra={
                "log_event": "game_request_failed",
                "error_type": type(error).__name__,
            },
        )
    except Exception:
        pass


posthog_log_provider = _initialize_posthog_logs()

if posthog_log_provider:
    atexit.register(posthog_log_provider.shutdown, timeout_millis=3000)
