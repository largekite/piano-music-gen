"""
Main generation service orchestrator.
Coordinates all backends with intelligent fallback chain.
"""
import os
import shutil
import datetime
from typing import Tuple, Optional, Callable, Awaitable
from uuid import uuid4

from ..models import MusicParameters, BackendType, MidiFileMetadata
from ..utils.prompt_generator import generate_ai_prompt
from ..config import settings
from .magenta_service import MagentaService
from .huggingface_service import HuggingFaceService
from .simple_midi_service import SimpleMidiService


class GenerationService:
    """
    Main service for music generation with fallback chain.

    Fallback order:
    - HuggingFace: HF Space → Simple MIDI
    - Magenta: Magenta Python API/CLI → Simple MIDI
    - Simple: Simple MIDI only
    """

    def __init__(self):
        self.magenta = MagentaService()
        self.huggingface = HuggingFaceService()
        self.simple = SimpleMidiService()

    async def generate(
        self,
        parameters: MusicParameters,
        progress_callback: Optional[Callable[[str, int, str], Awaitable[None]]] = None
    ) -> Tuple[Optional[MidiFileMetadata], Optional[str]]:
        """
        Generate music based on parameters with intelligent fallback.

        Args:
            parameters: Music generation parameters
            progress_callback: Optional async callback for progress updates
                              (stage, progress_percent, message)

        Returns:
            Tuple of (MidiFileMetadata, error_message)
        """
        # Route to appropriate backend
        if parameters.backend == BackendType.MAGENTA:
            return await self._generate_magenta(parameters, progress_callback)
        elif parameters.backend == BackendType.HUGGINGFACE:
            return await self._generate_huggingface(parameters, progress_callback)
        else:
            return await self._generate_simple(parameters, progress_callback)

    async def _generate_magenta(
        self,
        parameters: MusicParameters,
        progress_callback: Optional[Callable] = None
    ) -> Tuple[Optional[MidiFileMetadata], Optional[str]]:
        """Generate using Magenta with fallback to Simple MIDI."""
        if progress_callback:
            await progress_callback("initializing", 10, "Preparing Magenta generator...")

        # Map duration to steps
        duration_steps = {
            "30 sec": 64,
            "1 min": 128,
            "2 min": 256
        }
        steps = duration_steps.get(parameters.duration.value, 128)

        if progress_callback:
            await progress_callback("generating", 30, "Running Magenta RNN model...")

        # Try Magenta
        out_path, error = await self.magenta.generate(
            steps=steps,
            primer="60",  # Middle C
            target_key=parameters.key.value
        )

        if out_path:
            if progress_callback:
                await progress_callback("processing", 90, "Finalizing MIDI file...")

            # Move to persistent storage and create metadata
            return await self._finalize_file(out_path, parameters, BackendType.MAGENTA)

        # Fallback to Simple MIDI
        if progress_callback:
            await progress_callback("generating", 50, f"Magenta failed: {error}. Using Simple MIDI fallback...")

        return await self._generate_simple_fallback(parameters, progress_callback)

    async def _generate_huggingface(
        self,
        parameters: MusicParameters,
        progress_callback: Optional[Callable] = None
    ) -> Tuple[Optional[MidiFileMetadata], Optional[str]]:
        """Generate using HuggingFace with fallback to Simple MIDI."""
        if progress_callback:
            await progress_callback("initializing", 10, "Preparing AI prompt...")

        # Generate AI prompt
        prompt = parameters.prompt or generate_ai_prompt(
            style=parameters.style.value,
            key=parameters.key.value,
            tempo=parameters.tempo,
            mood=parameters.mood.value,
            duration=parameters.duration.value
        )

        if progress_callback:
            await progress_callback("generating", 30, "Contacting HuggingFace Space...")

        # Try HuggingFace
        out_path, error = await self.huggingface.generate(
            prompt=prompt,
            style=parameters.style.value,
            key=parameters.key.value,
            tempo=parameters.tempo,
            mood=parameters.mood.value,
            duration=parameters.duration.value
        )

        if out_path:
            if progress_callback:
                await progress_callback("processing", 90, "Finalizing MIDI file...")

            return await self._finalize_file(out_path, parameters, BackendType.HUGGINGFACE)

        # Fallback to Simple MIDI
        if progress_callback:
            await progress_callback("generating", 50, f"HuggingFace failed: {error}. Using Simple MIDI fallback...")

        return await self._generate_simple_fallback(parameters, progress_callback)

    async def _generate_simple(
        self,
        parameters: MusicParameters,
        progress_callback: Optional[Callable] = None
    ) -> Tuple[Optional[MidiFileMetadata], Optional[str]]:
        """Generate using Simple MIDI (no fallback needed)."""
        if progress_callback:
            await progress_callback("generating", 30, "Generating procedural MIDI...")

        duration_sec = {
            "30 sec": 30,
            "1 min": 60,
            "2 min": 120
        }.get(parameters.duration.value, 60)

        out_path, error = await self.simple.generate(
            tempo=parameters.tempo,
            duration_sec=duration_sec,
            mood=parameters.mood.value,
            key=parameters.key.value,
            style=parameters.style.value
        )

        if out_path:
            if progress_callback:
                await progress_callback("processing", 90, "Finalizing MIDI file...")

            return await self._finalize_file(out_path, parameters, BackendType.SIMPLE)

        return None, error

    async def _generate_simple_fallback(
        self,
        parameters: MusicParameters,
        progress_callback: Optional[Callable] = None
    ) -> Tuple[Optional[MidiFileMetadata], Optional[str]]:
        """Fallback generation using Simple MIDI."""
        duration_sec = {
            "30 sec": 30,
            "1 min": 60,
            "2 min": 120
        }.get(parameters.duration.value, 60)

        out_path, error = await self.simple.generate(
            tempo=parameters.tempo,
            duration_sec=duration_sec,
            mood=parameters.mood.value,
            key=parameters.key.value,
            style=parameters.style.value
        )

        if out_path:
            return await self._finalize_file(out_path, parameters, BackendType.SIMPLE)

        return None, error or "All generation methods failed"

    async def _finalize_file(
        self,
        temp_path: str,
        parameters: MusicParameters,
        actual_backend: BackendType
    ) -> Tuple[MidiFileMetadata, None]:
        """
        Move file to persistent storage and create metadata.

        Args:
            temp_path: Temporary file path
            parameters: Generation parameters
            actual_backend: The backend that actually generated the file

        Returns:
            Tuple of (MidiFileMetadata, None)
        """
        # Generate unique filename
        file_id = str(uuid4())
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        mood_slug = parameters.mood.value.lower()
        filename = f"piano_{mood_slug}_{timestamp}_{file_id}.mid"

        # Final path in persistent storage
        final_path = os.path.join(settings.GENERATED_MIDI_PATH, filename)

        # Move/copy file to persistent storage
        if temp_path != final_path:
            shutil.move(temp_path, final_path)

        # Get file size
        file_size = os.path.getsize(final_path)

        # Create metadata
        metadata = MidiFileMetadata(
            file_id=file_id,
            filename=filename,
            file_size=file_size,
            backend=actual_backend,
            parameters=parameters,
            created_at=datetime.datetime.now()
        )

        return metadata, None
