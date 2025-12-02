# 🎹 Piano Music Generator

A Streamlit web app that generates piano MIDI music using multiple backends:
- **Replicate API** — Fast cloud-based generation (requires API key)
- **Hugging Face Spaces** — Remote music generation model
- **Local Magenta** — Offline generation using Google Magenta

## Quick Start

### Prerequisites
- **macOS** (Intel or Apple Silicon)
- **Python 3.9+** (via system or conda)
- **Miniforge3** (lightweight conda) for managing dependencies

### Installation & Setup (5 minutes)

#### 1. Install Miniforge3 (if not already installed)
```bash
# Download and install Miniforge3 for your architecture
# For Apple Silicon (M1/M2/M3):
curl -L -o ~/miniforge3.sh https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-MacOSX-arm64.sh
bash ~/miniforge3.sh -b -p ~/miniforge3

# For Intel Mac:
curl -L -o ~/miniforge3.sh https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-MacOSX-x86_64.sh
bash ~/miniforge3.sh -b -p ~/miniforge3

# Initialize conda for your shell
source ~/miniforge3/etc/profile.d/conda.sh
conda init zsh  # or 'conda init bash' if using bash
```

#### 2. Create & Activate Conda Environment
```bash
source ~/miniforge3/etc/profile.d/conda.sh
conda create -y -n magenta python=3.9
conda activate magenta
conda install -y -c conda-forge numba llvmlite pkg-config libsndfile
```

#### 3. Install Python Dependencies
```bash
cd /path/to/piano-music-gen
python -m pip install --upgrade pip setuptools wheel
python -m pip install python-rtmidi magenta pretty_midi mido librosa
python -m pip install streamlit gradio-client requests
```

### Running the App

#### Option A: Using the Provided Script (Easiest)
```bash
cd /path/to/piano-music-gen
./run.sh
```
This automatically activates the conda environment and starts Streamlit on `http://localhost:8501`.

#### Option B: Manual Start
```bash
source ~/miniforge3/etc/profile.d/conda.sh
conda activate magenta
cd /path/to/piano-music-gen
streamlit run app_streamlit.py
```

The app will open at `http://localhost:8501` (or a similar local address).

## Features

### Backends

**1. Replicate (Fast)**
- Requires: Replicate API key (free tier available)
- Get key at: https://replicate.com
- Paste in the sidebar under "Replicate API key"
- ~30 seconds generation time

**2. Hugging Face Space**
- No key required
- Uses the `largekite/music` space
- Optional: Add HF token for authentication
- Variable generation time (1-3 minutes)

**3. Local Magenta**
- No internet required
- Runs offline on your machine
- Slower (~2-5 minutes first run, then faster)
- Requires the Magenta attention_rnn model bundle (~100MB download)

### UI Controls
- **Backend**: Select generation source
- **API Keys**: Input tokens/keys for authentication
- **Prompt Presets**: Quick templates (e.g., "Calm melody in C major")
- **Style, Key, Tempo, Mood, Duration**: Music parameters
- **Custom Prompt**: Describe the music you want
- **Show Debug Output**: See raw API responses (for troubleshooting)
- **Generate MIDI**: Start generation and download resulting `.mid` file

## Troubleshooting

### Issue: "conda: command not found"
- Miniforge3 not installed or not initialized
- Solution: Run `source ~/miniforge3/etc/profile.d/conda.sh` and ensure it's added to your shell profile

### Issue: "magenta environment not found"
- Conda env not created yet
- Solution: Run the setup steps 1–3 above

### Issue: "Failed to generate MIDI"
- Backend unavailable or rate-limited
- Solution: 
  1. Enable "Show debug output" to see the error
  2. Try a different backend
  3. Check internet connection if using remote backends

### Issue: "RuntimeError: llvm-config failed"
- Missing build tools (older issue, should be resolved in conda env)
- Solution: Ensure you installed `llvmlite` from conda-forge (not pip)

### Issue: Local Magenta generation is very slow
- First run downloads the model bundle (~100MB)
- Subsequent runs are faster
- Check disk space and network connection

## Development Notes

### File Structure
```
piano-music-gen/
├── app_streamlit.py          # Main Streamlit app
├── run.sh                      # Quick-start script
├── requirements.txt            # Pip dependencies
├── README.md                   # This file
├── MAGENTA_SETUP.md           # Detailed Magenta setup
├── magenta_generate.sh         # Helper script for Magenta CLI
└── magenta_generator.py        # Python wrapper for Magenta
```

### Adding New Backends
To integrate a new music generation API:
1. Create a `run_<backend>_generate(prompt, params...)` function
2. Add the backend to the selectbox in the sidebar
3. Call it in the generate button logic

### Environment Variables
- `REPLICATE_API_TOKEN`: Replicate API key (set automatically if provided in sidebar)
- `HUGGINGFACE_TOKEN`: HF token (optional, pass to client if needed)

## License & Attribution
- **Streamlit**: Open source (BSD-3-Clause)
- **Google Magenta**: Apache 2.0
- **Replicate**: Commercial service with free tier
- **Hugging Face**: Community models

## Next Steps
1. Install and run with `./run.sh`
2. Experiment with different prompts and backends
3. Generate MIDI files and import into your DAW/piano software
4. Modify `app_streamlit.py` to add custom backends or features

---

**Questions?** Check the debug output or review the error messages in the sidebar.
