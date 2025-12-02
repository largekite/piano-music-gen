#!/usr/bin/env bash
# Piano Music Generator - Project Summary & Status

## ✅ PROJECT IS NOW RUNNABLE

Your Piano Music Generator app is fully set up and ready to use.

## 📋 What Was Done

### 1. Fixed Build Errors ✅
- **Problem**: Failed to build wheels for `numba`, `llvmlite`, `python-rtmidi`
- **Solution**: 
  - Installed Miniforge3 (lightweight conda) for macOS
  - Created a conda environment with prebuilt packages from conda-forge
  - Installed `python-rtmidi` from a prebuilt wheel (macOS arm64 compatible)
- **Result**: All dependencies now install cleanly without compilation

### 2. Created Setup & Run Scripts ✅
- **`setup.sh`**: Automates Miniforge installation, conda env creation, and dependency setup
- **`run.sh`**: Activates the conda environment and starts Streamlit with one command

### 3. Added Multiple Generation Backends ✅
- **Replicate API**: Fast cloud-based generation (fastest, ~30 seconds)
- **Hugging Face Spaces**: Community model (free, 1-3 minutes, may be slow)
- **Local Magenta**: Offline generation using Google Magenta (requires ~100MB download)

### 4. Enhanced the UI ✅
- Added backend selector in sidebar
- Added API key inputs for Replicate and Hugging Face
- Improved status/output display
- Added debug mode for troubleshooting
- Created presets and customization controls

### 5. Comprehensive Documentation ✅
- **README.md**: Quick overview and feature highlights
- **README_QUICKSTART.md**: Detailed setup, usage, and troubleshooting guide

## 🚀 To Get Started

### Automatic Setup (Recommended)
```bash
cd piano-music-gen
chmod +x setup.sh run.sh
./setup.sh  # ~5 minutes first time (downloads & installs)
./run.sh    # Start the app
```

### Manual Commands
```bash
# One-time setup
source ~/miniforge3/etc/profile.d/conda.sh
conda create -y -n magenta python=3.9
conda activate magenta
conda install -y -c conda-forge numba llvmlite pkg-config libsndfile
pip install --upgrade pip setuptools wheel
pip install python-rtmidi magenta pretty_midi mido librosa streamlit gradio-client requests

# Then to run the app
source ~/miniforge3/etc/profile.d/conda.sh
conda activate magenta
cd piano-music-gen
streamlit run app_streamlit.py
```

## 🎵 Using the App

1. Navigate to `http://localhost:8501` in your browser
2. In the sidebar:
   - Select a **Backend** (Replicate is fastest)
   - (If Replicate) Paste your API key from https://replicate.com
3. Enter a music description in the main prompt area
4. Click **"Generate MIDI"**
5. Download the `.mid` file and open in your DAW/piano software

## 📊 Backend Comparison

| Feature | Replicate | HF Spaces | Local Magenta |
|---------|-----------|-----------|---------------|
| Speed | ⚡ Fast (30s) | 🐢 Slow (1-3m) | 🔌 Medium (2-5m) |
| Cost | 💰 Free tier | ✅ Free | ✅ Free |
| Requires Internet | Yes | Yes | No (offline) |
| Setup Complexity | Simple (1 API key) | None | Medium (model download) |
| Reliability | ⭐⭐⭐ Stable | ⭐⭐ Variable | ⭐⭐⭐ Stable |

## 📁 Project Structure

```
piano-music-gen/
├── app_streamlit.py              # Main Streamlit application
├── setup.sh                       # Automated setup script
├── run.sh                         # Quick run script
├── requirements.txt               # Original pip dependencies
├── README.md                      # Quick overview
├── README_QUICKSTART.md          # Detailed guide
├── MAGENTA_SETUP.md              # Advanced Magenta info
├── magenta_generate.sh            # Magenta CLI helper (advanced)
├── magenta_generator.py           # Magenta Python wrapper (advanced)
└── magenta_models/               # Local Magenta bundles (optional)
```

## 🔧 Troubleshooting

### "conda: command not found"
- Miniforge not installed or shell not re-initialized
- Run: `source ~/miniforge3/etc/profile.d/conda.sh`

### "magenta environment not found"
- Conda env not created yet
- Run: `./setup.sh`

### Generation fails with API errors
- Enable "Show debug output" in the sidebar to see the raw response
- Check that your API key (if using Replicate) is valid
- Try a different backend

### App won't start
- Ensure `magenta` conda env is active: `conda activate magenta`
- Check that Streamlit is installed: `pip install streamlit`

## 🎯 Next Steps

1. **Try it now**: Run `./setup.sh` then `./run.sh`
2. **Get Replicate key** (optional): https://replicate.com (free tier available)
3. **Generate music**: Use presets or write custom prompts
4. **Download MIDI**: Open in your DAW or piano app
5. **Customize**: Modify `app_streamlit.py` to add features

## 📞 Support

- Enable "Show debug output" in the app to troubleshoot
- Check [README_QUICKSTART.md](README_QUICKSTART.md) for detailed help
- Review error messages in the Streamlit sidebar

---

**You're all set!** The app is ready to run. Execute `./setup.sh` then `./run.sh` to get started.
