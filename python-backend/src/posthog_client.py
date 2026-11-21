"""Process-wide PostHog client for the Python Worker."""

import atexit
import logging
import os

from posthog import Posthog

logger = logging.getLogger(__name__)


POSTHOG_PROJECT_TOKEN = os.getenv("POSTHOG_PROJECT_TOKEN")
POSTHOG_HOST = os.getenv("POSTHOG_HOST")


def _missing_configuration_warning(variable_name):
    return (
        f"{variable_name} variable required by PostHog is missing or un-configured, "
        f"this causes events to be silently missed. This error stops appearing once "
        f"{variable_name} is configured"
    )


def _initialize_posthog():
    if not POSTHOG_PROJECT_TOKEN:
        if os.getenv("ENVIRONMENT") != "production":
            logger.warning(_missing_configuration_warning("POSTHOG_PROJECT_TOKEN"))
        return None

    if not POSTHOG_HOST:
        if os.getenv("ENVIRONMENT") != "production":
            logger.warning(_missing_configuration_warning("POSTHOG_HOST"))
        return None

    return Posthog(
        POSTHOG_PROJECT_TOKEN,
        host=POSTHOG_HOST,
        enable_exception_autocapture=True,
    )


posthog_client = _initialize_posthog()

if posthog_client:
    atexit.register(posthog_client.shutdown)
