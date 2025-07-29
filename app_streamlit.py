import streamlit as st
import os
from mido import Message, MidiFile, MidiTrack
import tempfile
from audiocraft.models import musicgen
from audiocraft.data.audio import audio_write

st.set_page_config(page_title="🎼 Piano Music Generator", layout="centered")

st.title("🎹 Piano Music Generator with AI")

# --- User Inputs ---
style = st.selectbox("Style", ["Classical", "Jazz", "Pop", "Ambient"])
key = st.selectbox("Key", ["C major", "D major", "G major", "A minor"])
tempo = st.slider("Tempo (BPM)", 40, 180, 100)
mood = st.radio("Mood", ["Happy", "Melancholic", "Dreamy", "Intense"])
prompt = st.text_input("🧠 AI Prompt", "a relaxing piano melody in D major, melancholic mood")

col1, col2 = st.columns(2)
# --- Generate MIDI ---
if col1.button("🎼 Generate MIDI"):
   with tempfile.NamedTemporaryFile(delete=False, suffix=".mid") as tmp:
       mid = MidiFile()
       track = MidiTrack()
       mid.tracks.append(track)
       for note in [60, 62, 64, 65, 67, 69, 71, 72]:
           track.append(Message('note_on', note=note, velocity=64, time=0))
           track.append(Message('note_off', note=note, velocity=64, time=480))
       mid.save(tmp.name)
       st.success("✅ MIDI Generated")
       st.audio(tmp.name)
       with open(tmp.name, "rb") as f:
           st.download_button("⬇️ Download MIDI", f, "scale.mid")
# --- Generate Audio from AI Prompt ---
if col2.button("🎧 AI Generate Audio"):
   st.info("⏳ Generating audio from prompt...")
   model = musicgen.MusicGen.get_pretrained('facebook/musicgen-small')
   model.set_generation_params(duration=10)
   wav = model.generate([prompt])
   output_path = os.path.join(tempfile.gettempdir(), "generated_piano.wav")
   audio_write("generated_piano", wav[0].cpu(), model.sample_rate, format="wav")
   st.audio(output_path)
   with open(output_path, "rb") as f:
       st.download_button("⬇️ Download Audio", f, "generated_piano.wav")
