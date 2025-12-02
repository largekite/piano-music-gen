"""magenta_generator.py

Lightweight Python wrapper that will try to run the Magenta CLI `melody_rnn_generate` if available.
If the CLI is not available, it prints install instructions and points to `MAGENTA_SETUP.md`.

Usage:
  python3 magenta_generator.py --out generated.mid --steps 128

This wrapper intentionally delegates to the Magenta CLI to avoid embedding TensorFlow model code.
"""

import argparse
import shutil
import subprocess
import sys
import os


def run_cli_generate(output_dir, num_steps, primer_melody="60"):
    if not shutil.which("melody_rnn_generate"):
        print("Error: melody_rnn_generate CLI not found. Make sure Magenta is installed and your virtualenv is active.")
        print("See MAGENTA_SETUP.md for installation instructions.")
        return 2

    bundle_dir = "magenta_models"
    bundle_file = os.path.join(bundle_dir, "attention_rnn.mag")
    if not os.path.exists(bundle_file):
        print(f"Bundle not found at {bundle_file}. Please run magenta_generate.sh or download the bundle manually.")
        return 3

    cmd = [
        "melody_rnn_generate",
        "--config=attention_rnn",
        f"--bundle_file={bundle_file}",
        f"--output_dir={output_dir}",
        f"--num_outputs=1",
        f"--num_steps={num_steps}",
        f"--primer_melody={primer_melody}",
    ]

    print("Running:", " ".join(cmd))
    proc = subprocess.run(cmd)
    return proc.returncode


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="magenta_output", help="Output directory for MIDI files")
    p.add_argument("--steps", type=int, default=128, help="Number of steps to generate")
    p.add_argument("--primer", default="60", help="Primer melody (comma-separated MIDI pitches or single pitch)")
    args = p.parse_args()

    os.makedirs(args.out, exist_ok=True)
    rc = run_cli_generate(args.out, args.steps, primer_melody=args.primer)
    if rc == 0:
        print("Generation complete. Look in", args.out)
    else:
        print("Generation failed with code", rc)
        sys.exit(rc)


if __name__ == "__main__":
    main()
