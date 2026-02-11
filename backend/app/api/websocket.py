"""
WebSocket handlers for real-time updates.
"""
import asyncio
from datetime import datetime

from ..models import (
    MusicParameters,
    GenerationStatus,
    GenerationStage
)
from ..services.generation_service import GenerationService

# Generation service instance
generation_service = GenerationService()

# Active WebSocket sessions (sid -> session info)
active_sessions = {}


async def handle_connection(sio, sid, environ):
    """Handle new WebSocket connection."""
    print(f"Client connected: {sid}")
    active_sessions[sid] = {
        "connected_at": datetime.now(),
        "current_job": None
    }


async def handle_disconnect(sio, sid):
    """Handle WebSocket disconnection."""
    print(f"Client disconnected: {sid}")
    if sid in active_sessions:
        del active_sessions[sid]


async def handle_generation_request(sio, sid, data):
    """
    Handle generation request from WebSocket client.

    Args:
        sio: SocketIO server instance
        sid: Session ID
        data: Request data containing parameters
    """
    try:
        # Parse parameters
        job_id = data.get("jobId")
        params_data = data.get("parameters", {})

        # Create parameters model
        parameters = MusicParameters(**params_data)

        # Store job ID in session
        if sid in active_sessions:
            active_sessions[sid]["current_job"] = job_id

        # Progress callback that emits to WebSocket
        async def progress_callback(stage: str, progress: int, message: str):
            await sio.emit("generation_progress", {
                "jobId": job_id,
                "stage": stage,
                "progress": progress,
                "message": message
            }, room=sid)

        # Send initial progress
        await progress_callback("initializing", 0, "Starting generation...")

        # Generate music
        result, error = await generation_service.generate(parameters, progress_callback)

        if result:
            # Send completion event
            await sio.emit("generation_complete", {
                "jobId": job_id,
                "fileId": result.file_id,
                "filename": result.filename,
                "fileSize": result.file_size,
                "downloadUrl": f"/api/files/{result.file_id}/download"
            }, room=sid)

        else:
            # Send error event
            await sio.emit("generation_error", {
                "jobId": job_id,
                "error": error or "Unknown error",
                "fallback": False  # Fallback already attempted
            }, room=sid)

    except Exception as e:
        # Send error event
        await sio.emit("generation_error", {
            "jobId": data.get("jobId"),
            "error": str(e),
            "fallback": False
        }, room=sid)


def register_handlers(sio):
    """
    Register all WebSocket event handlers.

    Args:
        sio: SocketIO server instance
    """
    @sio.event
    async def connect(sid, environ):
        await handle_connection(sio, sid, environ)

    @sio.event
    async def disconnect(sid):
        await handle_disconnect(sio, sid)

    @sio.event
    async def generate_request(sid, data):
        await handle_generation_request(sio, sid, data)

    @sio.event
    async def ping(sid, data):
        """Handle ping for keep-alive."""
        await sio.emit("pong", {"timestamp": datetime.now().isoformat()}, room=sid)
