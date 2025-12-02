#!/usr/bin/env bash
# Simple helper script to download a Melody RNN bundle and run melody_rnn_generate

set -euo pipefail

BUNDLE_DIR="magenta_models"
BUNDLE_FILE="$BUNDLE_DIR/attention_rnn.mag"
BUNDLE_URL="https://storage.googleapis.com/magentadata/models/melody_rnn/attention_rnn.mag"
OUT_DIR="magenta_output"

mkdir -p "$BUNDLE_DIR" "$OUT_DIR"

if [ ! -f "$BUNDLE_FILE" ]; then
  echo "Downloading bundle to $BUNDLE_FILE..."
  curl -L -o "$BUNDLE_FILE" "$BUNDLE_URL"
fi

if ! command -v melody_rnn_generate >/dev/null 2>&1; then
  echo "melody_rnn_generate not found in PATH. Make sure Magenta is installed and virtualenv active."
  echo "See MAGENTA_SETUP.md for install instructions."
  exit 2
fi

echo "Running melody_rnn_generate (output -> $OUT_DIR)..."
melody_rnn_generate \
  --config=attention_rnn \
  --bundle_file="$BUNDLE_FILE" \
  --output_dir="$OUT_DIR" \
  --num_outputs=1 \
  --num_steps=128 \
  --primer_melody="60"

echo "Done. Check $OUT_DIR for generated MIDI files."
