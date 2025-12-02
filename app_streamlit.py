import streamlit as st
import tempfile
import requests
import os
import base64
import json
import shutil
import subprocess
import glob
import random
import datetime
from gradio_client import Client

try:
    import mido
    MIDO_AVAILABLE = True
except ImportError:
    MIDO_AVAILABLE = False

def generate_ai_prompt(style, key, tempo, mood, duration):
    """Generate AI-powered music description based on parameters"""
    tempo_desc = {
        range(40, 70): "very slow",
        range(70, 90): "slow", 
        range(90, 120): "moderate",
        range(120, 140): "fast",
        range(140, 181): "very fast"
    }
    
    tempo_word = "moderate"
    for tempo_range, desc in tempo_desc.items():
        if tempo in tempo_range:
            tempo_word = desc
            break
    
    style_variations = {
        "Classical": ["elegant", "sophisticated", "graceful", "refined"],
        "Jazz": ["smooth", "syncopated", "improvisational", "swinging"],
        "Pop": ["catchy", "melodic", "contemporary", "accessible"],
        "Ambient": ["atmospheric", "ethereal", "floating", "meditative"]
    }
    
    mood_descriptors = {
        "Happy": ["joyful", "uplifting", "bright", "cheerful", "energetic"],
        "Melancholic": ["wistful", "nostalgic", "contemplative", "bittersweet", "reflective"],
        "Dreamy": ["flowing", "gentle", "soft", "peaceful", "serene"],
        "Intense": ["dramatic", "powerful", "passionate", "dynamic", "bold"]
    }
    
    import random
    style_adj = random.choice(style_variations.get(style, ["beautiful"]))
    mood_adj = random.choice(mood_descriptors.get(mood, ["expressive"]))
    
    prompts = [
        f"A {mood_adj} {style.lower()} piano piece in {key}, {tempo_word} tempo ({tempo} BPM), lasting {duration}",
        f"{style_adj.title()} {style.lower()} piano music with a {mood.lower()} mood, {tempo_word} paced in {key}",
        f"{tempo_word.title()} {mood.lower()} piano composition in {key}, {style.lower()} style, {duration} duration",
        f"Piano solo: {mood_adj} and {style_adj}, {key} signature, {tempo} BPM {style.lower()} piece"
    ]
    
    return random.choice(prompts)

st.set_page_config(page_title="🎼 Piano Music Generator", layout="wide", initial_sidebar_state="expanded")

# Create output directory for generated MIDI files
OUTPUT_DIR = "generated_midi"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Custom CSS for better styling
st.markdown("""
<style>
.main-header {
    text-align: center;
    padding: 2rem 0;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 10px;
    margin-bottom: 2rem;
}
.control-section {
    background: #f8f9fa;
    padding: 1.5rem;
    border-radius: 10px;
    margin-bottom: 1rem;
}
.stButton > button {
    width: 100%;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 0.75rem;
    border-radius: 8px;
    font-weight: bold;
}
</style>
""", unsafe_allow_html=True)

# Sidebar: backend + tokens + presets
with st.sidebar:
    st.markdown("### ⚙️ Configuration")
    
    backend = st.selectbox("🔧 Backend", ["Hugging Face Space", "Local (Magenta)"])
    
    # Backend info
    if backend == "Hugging Face Space":
        st.success("🎆 **AI Text-to-Music**: Uses your description to generate music")
    else:
        st.info("🔧 **Parameter-based**: Uses key signature and fixed patterns")
    
    with st.expander("🔑 API Keys", expanded=False):
        hf_token_input = st.text_input("HF Token (optional)", type="password")
    
    st.markdown("### 🎵 Quick Presets")
    preset_key_map = {
        "A calm melody in C major": "C major",
        "Upbeat jazz riff in G major": "G major",
        "Slow melancholic piano in A minor": "A minor",
    }
    preset = st.selectbox("Choose preset", list(preset_key_map.keys()))
    
    st.markdown("### 🔍 Debug")
    show_debug = st.checkbox("Show debug output")
    
    st.markdown("---")
    if backend == "Hugging Face Space":
        st.info("💡 **Tip**: Write detailed descriptions for better results")
    else:
        st.info("💡 **Tip**: Focus on the Key parameter - other settings are ignored")

# Main header
st.markdown("""
<div class="main-header">
    <h1>🎹 Piano Music Generator</h1>
    <p>Create beautiful piano MIDI music with AI</p>
</div>
""", unsafe_allow_html=True)

# Main content in tabs
tab1, tab2 = st.tabs(["🎼 Generate Music", "📊 Generated Files"])

with tab1:
    # Music parameters in organized sections
    col1, col2, col3 = st.columns([1, 1, 1])
    
    with col1:
        st.markdown("#### 🎨 Style & Genre")
        if backend == "Hugging Face Space":
            style = st.selectbox("Style", ["Classical", "Jazz", "Pop", "Ambient"], help="Used in AI description")
        else:
            style = st.selectbox("Style", ["Classical", "Jazz", "Pop", "Ambient"], help="⚠️ Not used by Local Magenta", disabled=True)
        
        preset_key = preset_key_map.get(preset, "C major")
        key_help = "Musical key signature" if backend == "Hugging Face Space" else "✅ Used by Local Magenta (transposed)"
        key = st.selectbox("Key", ["C major", "D major", "G major", "A minor"], 
                          index=["C major", "D major", "G major", "A minor"].index(preset_key) if preset_key in ["C major", "D major", "G major", "A minor"] else 0,
                          help=key_help)
    
    with col2:
        st.markdown("#### ⏱️ Timing & Mood")
        if backend == "Hugging Face Space":
            tempo = st.slider("Tempo (BPM)", 40, 180, 100, help="Used in AI description")
            mood = st.selectbox("Mood", ["Happy", "Melancholic", "Dreamy", "Intense"], help="Used in AI description")
        else:
            tempo = st.slider("Tempo (BPM)", 40, 180, 100, help="⚠️ Not used by Local Magenta", disabled=True)
            mood = st.selectbox("Mood", ["Happy", "Melancholic", "Dreamy", "Intense"], help="⚠️ Not used by Local Magenta", disabled=True)
    
    with col3:
        st.markdown("#### ⏰ Duration")
        if backend == "Hugging Face Space":
            duration = st.selectbox("Duration", ["30 sec", "1 min", "2 min"], index=1, help="Used in AI description")
        else:
            duration = st.selectbox("Duration", ["30 sec", "1 min", "2 min"], index=1, help="⚠️ Not used by Local Magenta", disabled=True)
        st.markdown("<br>", unsafe_allow_html=True)  # Spacing

    # Prompt section - only for Hugging Face
    if backend == "Hugging Face Space":
        st.markdown("#### 🧠 Music Description")
        st.info("🎆 **AI-Powered**: This description will be used by Hugging Face models to generate music")
        
        # Initialize AI prompt generation state
        if 'generate_ai_prompt_flag' not in st.session_state:
            st.session_state['generate_ai_prompt_flag'] = False
        
        col_prompt, col_ai = st.columns([4, 1])
        
        with col_ai:
            st.markdown("<br>", unsafe_allow_html=True)
            if st.button("🤖 AI Generate", help="Generate description from your settings"):
                st.session_state['generate_ai_prompt_flag'] = True
        
        with col_prompt:
            # Generate AI prompt if button was clicked
            if st.session_state['generate_ai_prompt_flag']:
                ai_prompt = generate_ai_prompt(style, key, tempo, mood, duration)
                st.session_state['generate_ai_prompt_flag'] = False
            else:
                # --- Sync prompt text area with preset ---
                if 'prompt_value' not in st.session_state:
                    st.session_state['prompt_value'] = preset
                if 'last_preset' not in st.session_state:
                    st.session_state['last_preset'] = preset
                
                # If the preset changed, update the prompt
                if preset != st.session_state['last_preset']:
                    st.session_state['prompt_value'] = preset
                    st.session_state['last_preset'] = preset
                
                ai_prompt = st.session_state['prompt_value']
            
            prompt = st.text_area(
                "Music description:", 
                value=ai_prompt, 
                height=100,
                help="Describe the music you want to generate, or use AI to auto-generate"
            )
            
            # Update stored value when user types
            if prompt != ai_prompt:
                st.session_state['prompt_value'] = prompt
    else:
        # For Local Magenta - show what parameters are used
        st.markdown("#### ⚙️ Generation Parameters")
        st.warning("🔧 **Local Magenta**: Uses only the **Key** parameter above. Style, mood, tempo, and duration are ignored.")
        
        # Set a default prompt for non-HF backends
        prompt = f"Piano music in {key} ({style} style, {mood} mood, {tempo} BPM, {duration})"
    
    # Generate button
    st.markdown("<br>", unsafe_allow_html=True)
    
    if backend == "Hugging Face Space":
        col_gen, col_refresh = st.columns([3, 1])
        with col_gen:
            generate_btn = st.button("🎵 Generate MIDI Music", type="primary")
        with col_refresh:
            if st.button("🔄 New AI Prompt"):
                st.session_state['generate_ai_prompt_flag'] = True
                st.rerun()
    else:
        generate_btn = st.button("🎵 Generate MIDI Music", type="primary")
    
    # Status and output areas
    status_box = st.empty()
    output_box = st.empty()

with tab2:
    st.markdown("#### 📁 Recently Generated Files")
    
    # List generated MIDI files
    midi_files = glob.glob(os.path.join(OUTPUT_DIR, "*.mid"))
    if midi_files:
        # Sort by modification time (newest first)
        midi_files.sort(key=os.path.getmtime, reverse=True)
        
        for i, file_path in enumerate(midi_files[:10]):  # Show last 10 files
            filename = os.path.basename(file_path)
            file_size = os.path.getsize(file_path)
            mod_time = datetime.datetime.fromtimestamp(os.path.getmtime(file_path))
            
            col_file, col_download = st.columns([3, 1])
            with col_file:
                st.write(f"**{filename}**")
                st.caption(f"Size: {file_size} bytes • Created: {mod_time.strftime('%Y-%m-%d %H:%M')}")
            
            with col_download:
                with open(file_path, "rb") as f:
                    st.download_button(
                        "⬇️ Download",
                        f.read(),
                        file_name=filename,
                        mime="audio/midi",
                        key=f"download_{i}"
                    )
    else:
        st.info("No MIDI files generated yet. Create some music in the Generate tab!")

def _save_midi_from_result(res):
    # Normalize lists
    if isinstance(res, (list, tuple)) and len(res) > 0:
        res = res[0]

    # If dict-like, try common keys
    if isinstance(res, dict):
        for k in ("name", "file", "url", "data", "path", "output", "result"):
            if k in res and res[k]:
                res = res[k]
                break

    # Bytes -> write directly
    if isinstance(res, (bytes, bytearray)):
        tf = tempfile.NamedTemporaryFile(delete=False, suffix=".mid")
        tf.write(res)
        tf.close()
        return tf.name

    # String: could be URL, base64, or filepath
    if isinstance(res, str):
        # URL -> download
        if res.startswith("http"):
            try:
                r = requests.get(res, timeout=30)
                r.raise_for_status()
                tf = tempfile.NamedTemporaryFile(delete=False, suffix=".mid")
                tf.write(r.content)
                tf.close()
                return tf.name
            except Exception:
                pass

        # Try base64 decode
        try:
            b = base64.b64decode(res)
            # basic sanity: MIDI header starts with 'MThd'
            if b and b[:4] == b"MThd":
                tf = tempfile.NamedTemporaryFile(delete=False, suffix=".mid")
                tf.write(b)
                tf.close()
                return tf.name
        except Exception:
            pass

        # Local path
        if os.path.exists(res):
            return res

    return None



def run_magenta_generate(steps=128, primer="60", target_key="C major"):
    # Check if melody_rnn_generate is available
    # Prefer the Python API if available
    def _run_magenta_python(bundle_file, steps, primer):
        try:
            from magenta.models.shared import sequence_generator_bundle
            from magenta.models.melody_rnn import melody_rnn_sequence_generator
            from magenta.protobuf import generator_pb2
            from magenta.music import sequences_lib, sequence_proto_to_midi_file
        except Exception as e:
            return None, f"Magenta Python API not available or failed to import: {e}"

        if not os.path.exists(bundle_file):
            return None, f"Bundle not found at {bundle_file}. Run `./magenta_generate.sh` to download it."

        try:
            bundle = sequence_generator_bundle.read_bundle_file(bundle_file)
            generator_map = melody_rnn_sequence_generator.get_generator_map()
            if "attention_rnn" not in generator_map:
                return None, f"Bundle/generator mismatch: 'attention_rnn' not available in generator_map"
            generator = generator_map["attention_rnn"](checkpoint=None, bundle=bundle)
            generator.initialize()

            # Create a primer melody sequence
            primer_pitches = [int(x) for x in str(primer).split(",") if x.strip().isdigit()]
            if not primer_pitches:
                primer_pitches = [60]
            seed = sequences_lib.melody_to_sequence(primer_pitches, start_step=0)

            gen_options = generator_pb2.GeneratorOptions()
            gen_options.args["temperature"].float_value = 1.0
            start_time = seed.total_time
            # rough step -> seconds mapping: assume 0.5s per step for simple control
            end_time = start_time + float(steps) * 0.5
            gen_section = gen_options.generate_sections.add(start_time=start_time, end_time=end_time)

            sequence = generator.generate(seed, gen_options)
            
            # Transpose to target key
            key_offsets = {
                "C major": 0, "D major": 2, "G major": 7, "A minor": 9
            }
            offset = key_offsets.get(target_key, 0)
            if offset != 0:
                for note in sequence.notes:
                    note.pitch += offset

            tf = tempfile.NamedTemporaryFile(delete=False, suffix=".mid")
            tf.close()
            sequence_proto_to_midi_file(sequence, tf.name)
            return tf.name, None
        except Exception as e:
            return None, f"Magenta generation error: {e}"

    bundle_file = os.path.join("magenta_models", "attention_rnn.mag")
    out, err = _run_magenta_python(bundle_file, steps, primer)
    if out:
        return out, None

    # If Python API isn't available or failed, fall back to CLI
    cli_missing = False
    if not shutil.which("melody_rnn_generate"):
        cli_missing = True

    out_dir = "magenta_output"
    os.makedirs(out_dir, exist_ok=True)
    if not os.path.exists(bundle_file):
        return None, f"Bundle not found at {bundle_file}. Run `./magenta_generate.sh` to download it."

    if cli_missing:
        return None, err or "Magenta CLI not found and Python API failed. See MAGENTA_SETUP.md to install Magenta."

    cmd = [
        "melody_rnn_generate",
        "--config=attention_rnn",
        f"--bundle_file={bundle_file}",
        f"--output_dir={out_dir}",
        f"--num_outputs=1",
        f"--num_steps={steps}",
        f"--primer_melody={primer}",
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if proc.returncode != 0:
            return None, f"Magenta CLI failed: {proc.stderr[:1000]}"
    except Exception as e:
        return None, f"Magenta CLI execution failed: {e}"

    # Find newest MIDI in out_dir
    mids = glob.glob(os.path.join(out_dir, "*.mid")) + glob.glob(os.path.join(out_dir, "*.midi"))
    if not mids:
        return None, "No MIDI files produced by Magenta."
    newest = max(mids, key=os.path.getmtime)
    return newest, None


def generate_simple_midi(tempo=100, duration_sec=30, mood="Happy", key="C major", style="Classical"):
    """Generate a simple procedural MIDI as last-resort fallback."""
    if not MIDO_AVAILABLE:
        return None, "mido not available"
    
    try:
        mid = mido.MidiFile()
        track = mido.MidiTrack()
        mid.tracks.append(track)
        

        # Map key to note ranges (MIDI note numbers)
        key_scales = {
            "C major": [60, 62, 64, 65, 67, 69, 71, 72],      # C D E F G A B C
            "D major": [62, 64, 66, 67, 69, 71, 73, 74],      # D E F# G A B C# D
            "G major": [67, 69, 71, 72, 74, 76, 78, 79],      # G A B C D E F# G
            "A minor": [69, 71, 72, 74, 76, 77, 79, 81],      # A B C D E F G A
        }

        # Default to C major if key not found
        scale = key_scales.get(key, key_scales["C major"])

        # Map style to General MIDI program number
        style_programs = {
            "Classical": 0,   # Acoustic Grand Piano
            "Jazz": 4,       # Electric Piano 1
            "Pop": 6,        # Harpsichord (or 7: Clavinet, or 24: Nylon Guitar, or 25: Steel Guitar)
            "Ambient": 88,   # Pad 1 (new age)
        }
        program_num = style_programs.get(style, 0)

        # Add program change for selected style
        track.append(mido.Message('program_change', program=program_num, time=0))
        
        # Calculate note duration in ticks (quarter note = 480 ticks at 120 BPM)
        ticks_per_beat = 480
        millisec_per_beat = 60000 / tempo
        
        total_notes = max(4, int(duration_sec * tempo / 60))
        for i in range(total_notes):
            note = random.choice(scale)
            duration = random.choice([0.5, 1, 1.5, 2])  # in beats
            duration_ticks = int(duration * ticks_per_beat)
            
            track.append(mido.Message('note_on', note=note, velocity=80, time=0))
            track.append(mido.Message('note_off', note=note, velocity=0, time=duration_ticks))
        
        # Save to persistent directory
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"piano_{mood}_{timestamp}.mid"
        filepath = os.path.join(OUTPUT_DIR, filename)
        mid.save(filepath)
        return filepath, None
    except Exception as e:
        return None, f"Simple MIDI generation failed: {e}"


if generate_btn:
    status_box.info("Generating — please wait...")
    output_box.empty()
    out_path = None
    error_msg = None

    if backend == "Local (Magenta)":
        # Run local Magenta generation
        status_box.info("Running local Magenta generator...")
        steps = 128 if duration == "1 min" else (64 if duration == "30 sec" else 256)
        out_path, error_msg = run_magenta_generate(steps=steps, primer=str(60), target_key=key)
        if error_msg:
            status_box.warning(error_msg + " — using simple fallback generation...")
            dur_sec = {"30 sec": 30, "1 min": 60, "2 min": 120}.get(duration, 60)
            out_path, fb_err = generate_simple_midi(tempo=tempo, duration_sec=dur_sec, mood=mood, key=key, style=style)
            if out_path:
                error_msg = None
            else:
                error_msg = fb_err
    else:
        # Try Hugging Face Space via gradio_client
        status_box.info("Contacting Hugging Face Space...")
        
        # Combine description with dropdown parameters
        enhanced_prompt = f"{prompt}. Style: {style}, Key: {key}, Tempo: {tempo} BPM, Mood: {mood}, Duration: {duration}"
        
        result = None
        try:
            client = Client("facebook/musicgen-small")
            result = client.predict(enhanced_prompt, 10, api_name="/predict")
        except Exception as client_err:
            if show_debug:
                status_box.warning(f"MusicGen failed: {client_err}")
            # Try alternative model
            try:
                client = Client("sander-wood/music-transformer")
                result = client.predict(enhanced_prompt, api_name="/predict")
            except Exception as alt_err:
                if show_debug:
                    status_box.warning(f"Music Transformer failed: {alt_err}")
                result = None

        if result:
            if show_debug:
                output_box.subheader("Debug: raw result")
                output_box.write(repr(result))
            out_path = _save_midi_from_result(result)
        else:
            # Fallback to simple MIDI if HF Space fails
            status_box.warning("Failed to get response from Hugging Face Space — using simple fallback generation...")
            dur_sec = {"30 sec": 30, "1 min": 60, "2 min": 120}.get(duration, 60)
            out_path, error_msg = generate_simple_midi(tempo=tempo, duration_sec=dur_sec, mood=mood, key=key, style=style)

    if out_path:
        status_box.success("✅ MIDI generated successfully!")
        
        # Create download section with file info
        with output_box.container():
            st.markdown("### 🎵 Your Music is Ready!")
            
            col_info, col_download = st.columns([2, 1])
            
            with col_info:
                filename = os.path.basename(out_path)
                file_size = os.path.getsize(out_path)
                st.write(f"**File:** {filename}")
                st.write(f"**Size:** {file_size} bytes")
                st.write(f"**Backend:** {backend}")
                st.write(f"**Key:** {key} • **Style:** {style} • **Mood:** {mood}")
            
            with col_download:
                with open(out_path, "rb") as f:
                    data = f.read()
                st.download_button(
                    "⬇️ Download MIDI", 
                    data, 
                    file_name=os.path.basename(out_path), 
                    mime="audio/midi",
                    type="primary"
                )
            
            st.success(f"💾 File saved to: `{out_path}`")
    else:
        if not error_msg:
            status_box.error("❌ Failed to generate MIDI. Try enabling debug output or switching backends.")
        else:
            status_box.error(f"❌ Generation failed: {error_msg}")

