"""
Pydantic models for API request/response validation.
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from enum import Enum


class BackendType(str, Enum):
    """Available generation backends."""
    HUGGINGFACE = "huggingface"
    MAGENTA = "magenta"
    SIMPLE = "simple"


class MusicStyle(str, Enum):
    """Musical styles."""
    CLASSICAL = "Classical"
    JAZZ = "Jazz"
    POP = "Pop"
    AMBIENT = "Ambient"


class MusicKey(str, Enum):
    """Musical keys."""
    C_MAJOR = "C major"
    D_MAJOR = "D major"
    G_MAJOR = "G major"
    A_MINOR = "A minor"


class Mood(str, Enum):
    """Musical moods."""
    HAPPY = "Happy"
    MELANCHOLIC = "Melancholic"
    DREAMY = "Dreamy"
    INTENSE = "Intense"


class Duration(str, Enum):
    """Music duration options."""
    THIRTY_SEC = "30 sec"
    ONE_MIN = "1 min"
    TWO_MIN = "2 min"


class GenerationStatus(str, Enum):
    """Generation job status."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class GenerationStage(str, Enum):
    """Stages of generation process."""
    INITIALIZING = "initializing"
    GENERATING = "generating"
    PROCESSING = "processing"
    COMPLETE = "complete"
    ERROR = "error"


class MusicParameters(BaseModel):
    """Parameters for music generation."""
    backend: BackendType
    style: MusicStyle
    key: MusicKey
    tempo: int = Field(ge=40, le=180, description="Tempo in BPM")
    mood: Mood
    duration: Duration
    prompt: Optional[str] = Field(None, description="Custom prompt for HuggingFace backend")


class GenerationRequest(BaseModel):
    """Request to generate music."""
    parameters: MusicParameters


class MidiFileMetadata(BaseModel):
    """Metadata about a MIDI file."""
    file_id: str
    filename: str
    file_size: int
    backend: BackendType
    parameters: MusicParameters
    created_at: datetime
    duration_seconds: Optional[float] = None
    track_count: Optional[int] = None
    note_count: Optional[int] = None


class GenerationJob(BaseModel):
    """Generation job with status and progress."""
    job_id: str
    status: GenerationStatus
    stage: GenerationStage
    progress: int = Field(ge=0, le=100, description="Progress percentage")
    message: str = ""
    parameters: MusicParameters
    created_at: datetime
    completed_at: Optional[datetime] = None
    result: Optional[MidiFileMetadata] = None
    error: Optional[str] = None


class GenerationProgressEvent(BaseModel):
    """WebSocket event for generation progress."""
    job_id: str
    stage: GenerationStage
    progress: int = Field(ge=0, le=100)
    message: str


class GenerationCompleteEvent(BaseModel):
    """WebSocket event for generation completion."""
    job_id: str
    file_id: str
    filename: str
    file_size: int
    download_url: str


class GenerationErrorEvent(BaseModel):
    """WebSocket event for generation error."""
    job_id: str
    error: str
    fallback: bool = Field(description="Whether fallback will be attempted")


class FileListQuery(BaseModel):
    """Query parameters for file listing."""
    page: int = Field(1, ge=1)
    page_size: int = Field(12, ge=1, le=100)
    search: Optional[str] = None
    backend: Optional[BackendType] = None
    style: Optional[MusicStyle] = None
    mood: Optional[Mood] = None
    key: Optional[MusicKey] = None
    sort_by: Literal["created_at", "filename", "file_size"] = "created_at"
    sort_order: Literal["asc", "desc"] = "desc"


class PaginatedResponse(BaseModel):
    """Paginated response wrapper."""
    items: list
    total: int
    page: int
    page_size: int
    has_next: bool
    has_prev: bool


class HealthResponse(BaseModel):
    """Health check response."""
    status: Literal["healthy", "degraded", "unhealthy"]
    backends: dict[str, bool]
    timestamp: datetime


class BackendStatus(BaseModel):
    """Status of a specific backend."""
    name: str
    available: bool
    message: Optional[str] = None
