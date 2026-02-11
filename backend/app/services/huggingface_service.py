"""
HuggingFace Space music generation service.
Uses Gradio client to interact with HuggingFace models.
Ported from original app_streamlit.py HuggingFace integration.
"""
import os
import base64
import tempfile
import requests
from typing import Tuple, Optional, Any
from gradio_client import Client

from ..config import settings


class HuggingFaceService:
    """Service for generating music using HuggingFace Spaces."""

    def __init__(self):
        self.primary_model = settings.HF_PRIMARY_MODEL
        self.fallback_model = settings.HF_FALLBACK_MODEL
        self.token = settings.HF_TOKEN

    async def generate(
        self,
        prompt: str,
        style: str,
        key: str,
        tempo: int,
        mood: str,
        duration: str
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Generate music using HuggingFace Spaces.

        Args:
            prompt: Text description of desired music
            style: Musical style
            key: Musical key
            tempo: Tempo in BPM
            mood: Musical mood
            duration: Duration

        Returns:
            Tuple of (output_file_path, error_message)
        """
        # Enhance prompt with parameters
        enhanced_prompt = f"{prompt}. Style: {style}, Key: {key}, Tempo: {tempo} BPM, Mood: {mood}, Duration: {duration}"

        # Try primary model
        result, error = await self._try_model(self.primary_model, enhanced_prompt)
        if result:
            return self._save_midi_from_result(result)

        # Try fallback model
        result, error = await self._try_model(self.fallback_model, enhanced_prompt)
        if result:
            return self._save_midi_from_result(result)

        return None, error or "All HuggingFace models failed"

    async def _try_model(self, model_name: str, prompt: str) -> Tuple[Any, Optional[str]]:
        """Try to generate music with a specific model."""
        try:
            client = Client(model_name, hf_token=self.token)
            result = client.predict(prompt, 10, api_name="/predict")
            return result, None
        except Exception as e:
            return None, f"{model_name} failed: {str(e)}"

    def _save_midi_from_result(self, res: Any) -> Tuple[Optional[str], Optional[str]]:
        """
        Parse and save MIDI from various response formats.
        Handles: bytes, URLs, base64 strings, file paths, dicts, lists.
        """
        # Normalize lists/tuples - take first element
        if isinstance(res, (list, tuple)) and len(res) > 0:
            res = res[0]

        # If dict-like, try common keys
        if isinstance(res, dict):
            for k in ("name", "file", "url", "data", "path", "output", "result"):
                if k in res and res[k]:
                    res = res[k]
                    break

        # Bytes/bytearray -> write directly
        if isinstance(res, (bytes, bytearray)):
            try:
                tf = tempfile.NamedTemporaryFile(delete=False, suffix=".mid", dir=settings.GENERATED_MIDI_PATH)
                tf.write(res)
                tf.close()
                return tf.name, None
            except Exception as e:
                return None, f"Failed to save bytes: {e}"

        # String: could be URL, base64, or filepath
        if isinstance(res, str):
            # URL -> download
            if res.startswith("http"):
                try:
                    r = requests.get(res, timeout=30)
                    r.raise_for_status()
                    tf = tempfile.NamedTemporaryFile(delete=False, suffix=".mid", dir=settings.GENERATED_MIDI_PATH)
                    tf.write(r.content)
                    tf.close()
                    return tf.name, None
                except Exception as e:
                    return None, f"Failed to download from URL: {e}"

            # Try base64 decode
            try:
                b = base64.b64decode(res)
                # Basic sanity: MIDI header starts with 'MThd'
                if b and b[:4] == b"MThd":
                    tf = tempfile.NamedTemporaryFile(delete=False, suffix=".mid", dir=settings.GENERATED_MIDI_PATH)
                    tf.write(b)
                    tf.close()
                    return tf.name, None
            except Exception:
                pass

            # Local path
            if os.path.exists(res):
                return res, None

        return None, f"Could not parse result format: {type(res)}"
