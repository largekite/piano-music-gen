"""
FastAPI main application.
Entry point for the Piano Music Generator backend.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import socketio

from .config import settings
from .api import generation, files, health, websocket

# Create FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="Backend API for Piano Music Generation with AI"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=settings.ALLOWED_ORIGINS,
    logger=True,
    engineio_logger=True
)

# Register WebSocket event handlers
websocket.register_handlers(sio)

# Mount API routes
app.include_router(
    generation.router,
    prefix=f"{settings.API_PREFIX}/generate",
    tags=["generation"]
)
app.include_router(
    files.router,
    prefix=f"{settings.API_PREFIX}/files",
    tags=["files"]
)
app.include_router(
    health.router,
    prefix=settings.API_PREFIX,
    tags=["health"]
)

# Serve static MIDI files
app.mount(
    "/storage",
    StaticFiles(directory=settings.GENERATED_MIDI_PATH),
    name="storage"
)

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Piano Music Generator API",
        "version": settings.API_VERSION,
        "docs": "/docs",
        "health": f"{settings.API_PREFIX}/health",
        "websocket": "/socket.io"
    }

# Create ASGI app with Socket.IO
socket_app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=app,
    socketio_path="/socket.io"
)

# This is what uvicorn should run
application = socket_app
