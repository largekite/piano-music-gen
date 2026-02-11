"""
Magenta music generation service.
Ported from original app_streamlit.py run_magenta_generate() function.
"""
import os
import shutil
import subprocess
import tempfile
import glob
from typing import Tuple, Optional
from ..utils.key_transposer import get_offset


class MagentaService:
    """Service for generating music using Google Magenta's Melody RNN."""

    def __init__(self, bundle_dir: str = "magenta_models", output_dir: str = "magenta_output"):
        self.bundle_dir = bundle_dir
        self.bundle_file = os.path.join(bundle_dir, "attention_rnn.mag")
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    async def generate(
        self,
        steps: int = 128,
        primer: str = "60",
        target_key: str = "C major"
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Generate music using Magenta.

        Args:
            steps: Number of generation steps (64-256)
            primer: Primer melody (comma-separated MIDI pitches or single pitch)
            target_key: Target musical key for transposition

        Returns:
            Tuple of (output_file_path, error_message)
        """
        # Try Python API first (preferred)
        out_path, error = await self._generate_python_api(steps, primer, target_key)
        if out_path:
            return out_path, None

        # Fall back to CLI if Python API fails
        return await self._generate_cli(steps, primer, target_key, fallback_error=error)

    async def _generate_python_api(
        self,
        steps: int,
        primer: str,
        target_key: str
    ) -> Tuple[Optional[str], Optional[str]]:
        """Generate using Magenta Python API."""
        try:
            from magenta.models.shared import sequence_generator_bundle
            from magenta.models.melody_rnn import melody_rnn_sequence_generator
            from magenta.protobuf import generator_pb2
            from magenta.music import sequences_lib, sequence_proto_to_midi_file
        except Exception as e:
            return None, f"Magenta Python API not available: {e}"

        if not os.path.exists(self.bundle_file):
            return None, f"Bundle not found at {self.bundle_file}. Run `./magenta_generate.sh` to download it."

        try:
            # Load bundle and initialize generator
            bundle = sequence_generator_bundle.read_bundle_file(self.bundle_file)
            generator_map = melody_rnn_sequence_generator.get_generator_map()

            if "attention_rnn" not in generator_map:
                return None, "Bundle/generator mismatch: 'attention_rnn' not available"

            generator = generator_map["attention_rnn"](checkpoint=None, bundle=bundle)
            generator.initialize()

            # Create primer melody sequence
            primer_pitches = [int(x) for x in str(primer).split(",") if x.strip().isdigit()]
            if not primer_pitches:
                primer_pitches = [60]  # Default to Middle C
            seed = sequences_lib.melody_to_sequence(primer_pitches, start_step=0)

            # Set generation options
            gen_options = generator_pb2.GeneratorOptions()
            gen_options.args["temperature"].float_value = 1.0
            start_time = seed.total_time
            end_time = start_time + float(steps) * 0.5  # Rough step → seconds mapping
            gen_options.generate_sections.add(start_time=start_time, end_time=end_time)

            # Generate sequence
            sequence = generator.generate(seed, gen_options)

            # Transpose to target key
            offset = get_offset(target_key)
            if offset != 0:
                for note in sequence.notes:
                    note.pitch += offset

            # Save to file
            tf = tempfile.NamedTemporaryFile(delete=False, suffix=".mid")
            tf.close()
            sequence_proto_to_midi_file(sequence, tf.name)
            return tf.name, None

        except Exception as e:
            return None, f"Magenta generation error: {e}"

    async def _generate_cli(
        self,
        steps: int,
        primer: str,
        target_key: str,
        fallback_error: Optional[str] = None
    ) -> Tuple[Optional[str], Optional[str]]:
        """Generate using Magenta CLI (fallback)."""
        cli_missing = not shutil.which("melody_rnn_generate")

        if not os.path.exists(self.bundle_file):
            return None, f"Bundle not found at {self.bundle_file}. Run `./magenta_generate.sh` to download it."

        if cli_missing:
            return None, fallback_error or "Magenta CLI not found and Python API failed. See MAGENTA_SETUP.md."

        cmd = [
            "melody_rnn_generate",
            "--config=attention_rnn",
            f"--bundle_file={self.bundle_file}",
            f"--output_dir={self.output_dir}",
            "--num_outputs=1",
            f"--num_steps={steps}",
            f"--primer_melody={primer}",
        ]

        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if proc.returncode != 0:
                return None, f"Magenta CLI failed: {proc.stderr[:1000]}"
        except Exception as e:
            return None, f"Magenta CLI execution failed: {e}"

        # Find newest MIDI file in output directory
        mids = glob.glob(os.path.join(self.output_dir, "*.mid")) + \
               glob.glob(os.path.join(self.output_dir, "*.midi"))
        if not mids:
            return None, "No MIDI files produced by Magenta."

        newest = max(mids, key=os.path.getmtime)
        return newest, None
