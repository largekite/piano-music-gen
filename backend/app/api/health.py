"""
Health check and backend status endpoints.
"""
from fastapi import APIRouter
from datetime import datetime
import os
import shutil

from ..models import HealthResponse, BackendStatus
from ..config import settings

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Check overall system health and backend availability."""
    backends = {}

    # Check Magenta availability
    magenta_available = (
        os.path.exists(settings.MAGENTA_BUNDLE_FILE) and
        (shutil.which("melody_rnn_generate") is not None or _check_magenta_python())
    )
    backends["magenta"] = magenta_available

    # Check HuggingFace availability (basic check - can always try)
    backends["huggingface"] = True

    # Simple MIDI always available if mido is installed
    try:
        import mido
        backends["simple"] = True
    except ImportError:
        backends["simple"] = False

    # Determine overall status
    if all(backends.values()):
        status = "healthy"
    elif any(backends.values()):
        status = "degraded"
    else:
        status = "unhealthy"

    return HealthResponse(
        status=status,
        backends=backends,
        timestamp=datetime.now()
    )


@router.get("/backends", response_model=list[BackendStatus])
async def get_backend_status():
    """Get detailed status of each backend."""
    statuses = []

    # Magenta status
    magenta_msg = None
    if not os.path.exists(settings.MAGENTA_BUNDLE_FILE):
        magenta_msg = f"Bundle file not found at {settings.MAGENTA_BUNDLE_FILE}"
    elif not shutil.which("melody_rnn_generate") and not _check_magenta_python():
        magenta_msg = "Magenta CLI and Python API not available"

    statuses.append(BackendStatus(
        name="magenta",
        available=magenta_msg is None,
        message=magenta_msg
    ))

    # HuggingFace status
    statuses.append(BackendStatus(
        name="huggingface",
        available=True,
        message="Cloud API - requires internet connection"
    ))

    # Simple MIDI status
    try:
        import mido
        statuses.append(BackendStatus(
            name="simple",
            available=True,
            message="Procedural generation available"
        ))
    except ImportError:
        statuses.append(BackendStatus(
            name="simple",
            available=False,
            message="mido library not installed"
        ))

    return statuses


def _check_magenta_python() -> bool:
    """Check if Magenta Python API is available."""
    try:
        from magenta.models.melody_rnn import melody_rnn_sequence_generator
        return True
    except ImportError:
        return False
