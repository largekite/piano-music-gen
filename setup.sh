#!/bin/bash
# Setup script for Piano Music Generator on macOS
# Automates Miniforge3 installation, conda env creation, and dependency installation

set -e

echo "🎹 Piano Music Generator - Setup Script"
echo "========================================"
echo ""

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    MINIFORGE_FILE="Miniforge3-MacOSX-arm64.sh"
    echo "Detected: Apple Silicon (M1/M2/M3)"
elif [ "$ARCH" = "x86_64" ]; then
    MINIFORGE_FILE="Miniforge3-MacOSX-x86_64.sh"
    echo "Detected: Intel Mac"
else
    echo "Error: Unsupported architecture: $ARCH"
    exit 1
fi

echo ""

# Step 1: Check if Miniforge3 is already installed
if [ -f "$HOME/miniforge3/bin/conda" ]; then
    echo "✅ Miniforge3 already installed at ~/miniforge3"
else
    echo "📦 Installing Miniforge3..."
    curl -L -o /tmp/$MINIFORGE_FILE https://github.com/conda-forge/miniforge/releases/latest/download/$MINIFORGE_FILE
    bash /tmp/$MINIFORGE_FILE -b -p $HOME/miniforge3
    rm /tmp/$MINIFORGE_FILE
    echo "✅ Miniforge3 installed successfully"
fi

# Step 2: Initialize conda
echo ""
echo "🔧 Initializing conda..."
source $HOME/miniforge3/etc/profile.d/conda.sh

# Detect shell and add conda init if needed
if [[ "$SHELL" == */zsh ]]; then
    SHELL_RC="$HOME/.zshrc"
elif [[ "$SHELL" == */bash ]]; then
    SHELL_RC="$HOME/.bashrc"
else
    SHELL_RC="$HOME/.profile"
fi

if ! grep -q "conda initialize" "$SHELL_RC" 2>/dev/null; then
    echo "Adding conda init to $SHELL_RC..."
    conda init $(basename $SHELL)
else
    echo "✅ Conda already initialized in $SHELL_RC"
fi

echo ""

# Step 3: Create magenta conda environment
echo "🌍 Creating conda environment 'magenta'..."
if conda env list | grep -q "^magenta "; then
    echo "✅ Environment 'magenta' already exists"
else
    conda create -y -n magenta python=3.9
    echo "✅ Conda environment created"
fi

# Step 4: Install conda-forge packages
echo ""
echo "📦 Installing packages from conda-forge..."
conda activate magenta
conda install -y -c conda-forge numba llvmlite pkg-config libsndfile
echo "✅ Conda packages installed"

# Step 5: Install Python packages via pip
echo ""
echo "📦 Installing Python packages via pip..."
python -m pip install --upgrade pip setuptools wheel > /dev/null 2>&1
python -m pip install python-rtmidi magenta pretty_midi mido librosa streamlit gradio-client requests > /dev/null 2>&1
echo "✅ Python packages installed"

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start the app, run:"
echo "   cd $(pwd)"
echo "   ./run.sh"
echo ""
echo "Or manually:"
echo "   source ~/miniforge3/etc/profile.d/conda.sh"
echo "   conda activate magenta"
echo "   streamlit run app_streamlit.py"
echo ""
