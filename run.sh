#!/bin/bash
# Run the Piano Music Generator Streamlit app
# Activates the conda 'magenta' environment and starts Streamlit

set -e

# Detect shell init file based on current shell
if [[ "$SHELL" == */bash ]]; then
    INIT_FILE="$HOME/.bashrc"
elif [[ "$SHELL" == */zsh ]]; then
    INIT_FILE="$HOME/.zshrc"
else
    INIT_FILE="$HOME/.profile"
fi

# Initialize conda for this shell session
if [ -f "$HOME/miniforge3/etc/profile.d/conda.sh" ]; then
    source "$HOME/miniforge3/etc/profile.d/conda.sh"
else
    echo "Error: Miniforge3 not found at $HOME/miniforge3"
    echo "Please install Miniforge3 first. See README.md for instructions."
    exit 1
fi

# Activate the magenta conda environment
conda activate magenta 2>/dev/null || {
    echo "Error: 'magenta' conda environment not found."
    echo "Please create it first by running:"
    echo "  conda create -y -n magenta python=3.9"
    echo "  conda activate magenta"
    echo "  conda install -y -c conda-forge numba llvmlite pkg-config libsndfile"
    echo "  python -m pip install python-rtmidi magenta pretty_midi mido librosa absl-py"
    exit 1
}

# Ensure we're in the repo directory
REPO_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$REPO_DIR"

echo "🎹 Starting Piano Music Generator..."
echo "Repo directory: $REPO_DIR"
echo "Conda environment: magenta"
echo ""
echo "Open your browser to: http://localhost:8501"
echo "Press Ctrl+C to stop the server."
echo ""

# Start Streamlit
python -m streamlit run app_streamlit.py --server.port 8501 --server.headless false
