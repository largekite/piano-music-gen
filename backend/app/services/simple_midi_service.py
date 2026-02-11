"""
Simple procedural MIDI generation service.
Used as last-resort fallback when other backends fail.
Ported from original app_streamlit.py generate_simple_midi() function.
"""
import os
import random
import datetime
from typing import Tuple, Optional

try:
    import mido
    MIDO_AVAILABLE = True
except ImportError:
    MIDO_AVAILABLE = False

from ..utils.key_transposer import get_scale
from ..config import settings


class SimpleMidiService:
    """Service for generating simple procedural MIDI files."""

    def __init__(self, output_dir: str = None):
        self.output_dir = output_dir or settings.GENERATED_MIDI_PATH

    async def generate(
        self,
        tempo: int = 100,
        duration_sec: int = 30,
        mood: str = "Happy",
        key: str = "C major",
        style: str = "Classical"
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Generate a simple procedural MIDI as last-resort fallback.

        Args:
            tempo: Tempo in BPM (40-180)
            duration_sec: Duration in seconds
            mood: Musical mood
            key: Musical key
            style: Musical style

        Returns:
            Tuple of (output_file_path, error_message)
        """
        if not MIDO_AVAILABLE:
            return None, "mido library not available"

        try:
            mid = mido.MidiFile()
            track = mido.MidiTrack()
            mid.tracks.append(track)

            # Get scale for the key
            scale = get_scale(key)

            # Map style to General MIDI program number
            style_programs = {
                "Classical": 0,   # Acoustic Grand Piano
                "Jazz": 4,        # Electric Piano 1
                "Pop": 6,         # Harpsichord
                "Ambient": 88,    # Pad 1 (new age)
            }
            program_num = style_programs.get(style, 0)

            # Add program change for selected style
            track.append(mido.Message('program_change', program=program_num, time=0))

            # Calculate note duration in ticks (quarter note = 480 ticks at 120 BPM)
            ticks_per_beat = 480

            # Calculate total number of notes based on tempo and duration
            total_notes = max(4, int(duration_sec * tempo / 60))

            for i in range(total_notes):
                # Select random note from scale
                note = random.choice(scale)

                # Random duration in beats (0.5 to 2 beats)
                duration = random.choice([0.5, 1, 1.5, 2])
                duration_ticks = int(duration * ticks_per_beat)

                # Add note on and note off messages
                track.append(mido.Message('note_on', note=note, velocity=80, time=0))
                track.append(mido.Message('note_off', note=note, velocity=0, time=duration_ticks))

            # Save to persistent directory
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"piano_{mood}_{timestamp}.mid"
            filepath = os.path.join(self.output_dir, filename)

            mid.save(filepath)
            return filepath, None

        except Exception as e:
            return None, f"Simple MIDI generation failed: {e}"
