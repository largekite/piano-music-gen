# 🎹 Piano Music Generator

Generate piano MIDI music using AI. Works with multiple backends: Replicate API, Hugging Face Spaces, and local Magenta.

## ⚡ Quick Start

### Fastest Path (1 minute)
```bash
cd piano-music-gen
chmod +x setup.sh run.sh
./setup.sh  # One-time setup (installs Miniforge, dependencies)
./run.sh    # Start the app
```

Open `http://localhost:8501` in your browser and start generating!

### Manual Setup
See [README_QUICKSTART.md](README_QUICKSTART.md) for detailed instructions.

## 🎵 Features

- **Multiple backends**: Replicate (fastest), Hugging Face Spaces, Local Magenta
- **Easy MIDI export**: Download generated music as `.mid` files
- **No GPU needed**: Works on CPU (macOS Intel & Apple Silicon)
- **Customizable**: Style, key, tempo, mood, duration parameters
- **Debug mode**: Inspect raw API responses

## 📋 Requirements

- macOS (Intel or Apple Silicon)
- Python 3.9+ (installed via Miniforge)
- ~2GB disk space (for Magenta models, optional)

## 🚀 Usage

1. Run `./setup.sh` (first time only)
2. Run `./run.sh` to start the app
3. Select a backend and enter any API keys (if needed)
4. Describe the music and click "Generate MIDI"
5. Download the generated `.mid` file

## 🔌 Backends

| Backend | Speed | Requirements | Notes |
|---------|-------|--------------|-------|
| **Replicate** | ⚡ Fast (30s) | API key (free tier) | Cloud-based, internet required |
| **HF Spaces** | 🐢 Slow (1-3min) | Optional HF token | Community model, internet required |
| **Magenta** | 🔌 Medium (2-5min) | None | Offline, first run downloads model |

## 🛠️ Troubleshooting

**App won't start?**
- Run `./setup.sh` to install all dependencies
- Ensure `~/miniforge3` exists

**Backend errors?**
- Enable "Show debug output" in the sidebar
- Check your API key (Replicate/HF)
- Try a different backend

**Still stuck?**
- See [README_QUICKSTART.md](README_QUICKSTART.md) for detailed troubleshooting

## 📚 Documentation

- [Quick Start Guide](README_QUICKSTART.md) — Detailed setup & features
- [Magenta Setup](MAGENTA_SETUP.md) — Advanced local generation

## 📝 License

MIT License. See individual components for their licenses (Streamlit, Magenta, etc.)
