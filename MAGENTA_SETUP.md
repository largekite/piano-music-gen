Magenta local setup and example
================================

This document shows how to install Magenta locally (recommended inside a Python virtual environment) and how to run a simple Melody RNN generation to produce a MIDI file.

macOS (recommended using a venv)
-------------------------------

1. Create and activate a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
```

2. Install a compatible TensorFlow and Magenta

Magenta currently depends on TensorFlow. For CPU-only use install a CPU build; replace versions if you need GPU support.

```bash
pip install "tensorflow-cpu>=2.10.0" magenta
```

3. (Optional) Install additional tools

```bash
pip install pretty_midi mido
```

Generate MIDI using the Melody RNN bundle (CLI)
---------------------------------------------

Magenta ships CLI tools such as `melody_rnn_generate`. One easy way is to download a pre-built bundle and run the generator:

1. Download a pre-trained bundle (example: `attention_rnn`):

```bash
mkdir -p magenta_models
curl -L -o magenta_models/attention_rnn.mag \
  https://storage.googleapis.com/magentadata/models/melody_rnn/attention_rnn.mag
```

2. Run generation (example):

```bash
melody_rnn_generate \
  --config=attention_rnn \
  --bundle_file=magenta_models/attention_rnn.mag \
  --output_dir=magenta_output \
  --num_outputs=1 \
  --num_steps=128 \
  --primer_melody="60"
```

This will write one MIDI file into `magenta_output`.

Docker alternative
------------------

If you prefer not to install TF locally, use a Docker image with Magenta preinstalled or build one yourself. Example Docker usage is outside the scope of this doc but is recommended for consistent environments.

Notes
-----
- If `melody_rnn_generate` is not found, ensure the virtualenv is activated and that `magenta` installation succeeded without errors.
- Model/bundle names and CLI flags can change between versions — consult Magenta docs if the commands fail.

Example helper scripts are included in this repository:
- `magenta_generate.sh` — shell wrapper that downloads the bundle and runs generation
- `magenta_generator.py` — a Python wrapper that will invoke the CLI when available
