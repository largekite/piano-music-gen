"""
File management endpoints.
"""
import os
import glob
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from typing import Optional

from ..models import MidiFileMetadata, PaginatedResponse, BackendType, MusicStyle, Mood, MusicKey
from ..config import settings

router = APIRouter()


@router.get("/files", response_model=PaginatedResponse)
async def list_files(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    search: Optional[str] = None,
    backend: Optional[BackendType] = None,
    style: Optional[MusicStyle] = None,
    mood: Optional[Mood] = None,
    key: Optional[MusicKey] = None,
    sort_by: str = Query("created_at", regex="^(created_at|filename|file_size)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$")
):
    """
    List MIDI files with pagination, search, and filtering.

    Args:
        page: Page number (1-indexed)
        page_size: Items per page
        search: Search query for filename
        backend: Filter by backend
        style: Filter by style
        mood: Filter by mood
        key: Filter by musical key
        sort_by: Sort field
        sort_order: Sort direction

    Returns:
        Paginated list of file metadata
    """
    # Get all MIDI files
    midi_pattern = os.path.join(settings.GENERATED_MIDI_PATH, "*.mid")
    all_files = glob.glob(midi_pattern)

    # Convert to file metadata (simplified without database)
    file_list = []
    for filepath in all_files:
        filename = os.path.basename(filepath)

        # Apply search filter
        if search and search.lower() not in filename.lower():
            continue

        # Get file stats
        stats = os.stat(filepath)
        file_id = filename.replace(".mid", "")  # Simplified

        # Create basic metadata (without full parameters - would need database)
        metadata = {
            "file_id": file_id,
            "filename": filename,
            "file_size": stats.st_size,
            "created_at": stats.st_ctime,
            "download_url": f"/api/files/{file_id}/download"
        }
        file_list.append(metadata)

    # Sort
    reverse = (sort_order == "desc")
    if sort_by == "filename":
        file_list.sort(key=lambda x: x["filename"], reverse=reverse)
    elif sort_by == "file_size":
        file_list.sort(key=lambda x: x["file_size"], reverse=reverse)
    else:  # created_at
        file_list.sort(key=lambda x: x["created_at"], reverse=reverse)

    # Pagination
    total = len(file_list)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_items = file_list[start_idx:end_idx]

    return PaginatedResponse(
        items=paginated_items,
        total=total,
        page=page,
        page_size=page_size,
        has_next=end_idx < total,
        has_prev=page > 1
    )


@router.get("/files/{file_id}")
async def get_file_metadata(file_id: str):
    """Get metadata for a specific file."""
    # Find file by ID (simplified - would use database in production)
    midi_files = glob.glob(os.path.join(settings.GENERATED_MIDI_PATH, "*.mid"))

    for filepath in midi_files:
        if file_id in filepath:
            filename = os.path.basename(filepath)
            stats = os.stat(filepath)

            return {
                "file_id": file_id,
                "filename": filename,
                "file_size": stats.st_size,
                "created_at": stats.st_ctime,
                "download_url": f"/api/files/{file_id}/download"
            }

    raise HTTPException(status_code=404, detail="File not found")


@router.get("/files/{file_id}/download")
async def download_file(file_id: str):
    """Download a MIDI file."""
    # Find file by ID
    midi_files = glob.glob(os.path.join(settings.GENERATED_MIDI_PATH, "*.mid"))

    for filepath in midi_files:
        if file_id in filepath:
            filename = os.path.basename(filepath)
            return FileResponse(
                path=filepath,
                filename=filename,
                media_type="audio/midi"
            )

    raise HTTPException(status_code=404, detail="File not found")


@router.delete("/files/{file_id}")
async def delete_file(file_id: str):
    """Delete a MIDI file."""
    # Find and delete file by ID
    midi_files = glob.glob(os.path.join(settings.GENERATED_MIDI_PATH, "*.mid"))

    for filepath in midi_files:
        if file_id in filepath:
            os.remove(filepath)
            return {"message": "File deleted successfully", "file_id": file_id}

    raise HTTPException(status_code=404, detail="File not found")


@router.get("/files/search")
async def search_files(q: str):
    """Search files by filename."""
    midi_files = glob.glob(os.path.join(settings.GENERATED_MIDI_PATH, "*.mid"))
    results = []

    for filepath in midi_files:
        filename = os.path.basename(filepath)
        if q.lower() in filename.lower():
            file_id = filename.replace(".mid", "")
            stats = os.stat(filepath)

            results.append({
                "file_id": file_id,
                "filename": filename,
                "file_size": stats.st_size,
                "created_at": stats.st_ctime
            })

    return {"results": results, "total": len(results)}
