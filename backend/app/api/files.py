"""
File management endpoints.
"""
import os
import glob
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from typing import Optional

from ..models import MidiFileMetadata, PaginatedResponse, BackendType, MusicStyle, Mood, MusicKey, MidiEditRequest
from ..config import settings

try:
    import mido
    MIDO_AVAILABLE = True
except ImportError:
    MIDO_AVAILABLE = False

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
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


@router.get("/{file_id}")
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


@router.get("/{file_id}/download")
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


@router.delete("/{file_id}")
async def delete_file(file_id: str):
    """Delete a MIDI file."""
    # Find and delete file by ID
    midi_files = glob.glob(os.path.join(settings.GENERATED_MIDI_PATH, "*.mid"))

    for filepath in midi_files:
        if file_id in filepath:
            os.remove(filepath)
            return {"message": "File deleted successfully", "file_id": file_id}

    raise HTTPException(status_code=404, detail="File not found")


@router.get("/search")
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


@router.get("/{file_id}/notes")
async def get_file_notes(file_id: str):
    """Get all notes from a MIDI file for visualization and editing."""
    if not MIDO_AVAILABLE:
        raise HTTPException(status_code=500, detail="mido library not available")

    midi_files = glob.glob(os.path.join(settings.GENERATED_MIDI_PATH, "*.mid"))

    for filepath in midi_files:
        if file_id in filepath:
            mid = mido.MidiFile(filepath)
            notes = []
            tempo = 500000  # default 120 BPM

            for track_idx, track in enumerate(mid.tracks):
                current_time = 0  # in ticks
                active_notes = {}  # note -> (start_tick, velocity)

                for msg in track:
                    current_time += msg.time

                    if msg.type == 'set_tempo':
                        tempo = msg.tempo

                    if msg.type == 'note_on' and msg.velocity > 0:
                        active_notes[msg.note] = (current_time, msg.velocity)
                    elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
                        if msg.note in active_notes:
                            start_tick, velocity = active_notes.pop(msg.note)
                            dur_ticks = current_time - start_tick
                            # Convert ticks to seconds
                            start_sec = mido.tick2second(start_tick, mid.ticks_per_beat, tempo)
                            dur_sec = mido.tick2second(dur_ticks, mid.ticks_per_beat, tempo)
                            if dur_sec > 0:
                                notes.append({
                                    "midi": msg.note,
                                    "time": round(start_sec, 4),
                                    "duration": round(dur_sec, 4),
                                    "velocity": velocity,
                                    "track": track_idx,
                                })

            # Sort by time
            notes.sort(key=lambda n: (n["time"], n["midi"]))

            bpm = round(mido.tempo2bpm(tempo))
            total_duration = max((n["time"] + n["duration"] for n in notes), default=0)

            return {
                "file_id": file_id,
                "notes": notes,
                "tempo": bpm,
                "duration": round(total_duration, 2),
                "ticks_per_beat": mid.ticks_per_beat,
                "track_count": len(mid.tracks),
                "note_count": len(notes),
            }

    raise HTTPException(status_code=404, detail="File not found")


@router.put("/{file_id}/notes")
async def update_file_notes(file_id: str, edit_request: MidiEditRequest):
    """Update a MIDI file with new notes (from the piano roll editor)."""
    if not MIDO_AVAILABLE:
        raise HTTPException(status_code=500, detail="mido library not available")

    midi_files = glob.glob(os.path.join(settings.GENERATED_MIDI_PATH, "*.mid"))

    for filepath in midi_files:
        if file_id in filepath:
            # Build a new MIDI file from the provided notes
            mid = mido.MidiFile(ticks_per_beat=480)
            track = mido.MidiTrack()
            mid.tracks.append(track)

            tempo_us = mido.bpm2tempo(edit_request.tempo)
            track.append(mido.MetaMessage('set_tempo', tempo=tempo_us, time=0))
            track.append(mido.Message('program_change', program=0, channel=0, time=0))

            # Convert notes to MIDI events
            events = []
            for note in edit_request.notes:
                start_tick = mido.second2tick(note.time, 480, tempo_us)
                dur_tick = mido.second2tick(note.duration, 480, tempo_us)
                dur_tick = max(1, dur_tick)
                events.append(('on', start_tick, note.midi, note.velocity))
                events.append(('off', start_tick + dur_tick, note.midi, 0))

            # Sort events by tick time
            events.sort(key=lambda e: (e[1], 0 if e[0] == 'off' else 1))

            prev_tick = 0
            for event_type, tick, note_num, vel in events:
                delta = max(0, tick - prev_tick)
                if event_type == 'on':
                    track.append(mido.Message('note_on', note=note_num, velocity=vel, channel=0, time=delta))
                else:
                    track.append(mido.Message('note_off', note=note_num, velocity=0, channel=0, time=delta))
                prev_tick = tick

            track.append(mido.MetaMessage('end_of_track', time=0))

            mid.save(filepath)
            file_size = os.path.getsize(filepath)

            return {
                "file_id": file_id,
                "filename": os.path.basename(filepath),
                "file_size": file_size,
                "note_count": len(edit_request.notes),
                "message": "MIDI file updated successfully",
            }

    raise HTTPException(status_code=404, detail="File not found")
