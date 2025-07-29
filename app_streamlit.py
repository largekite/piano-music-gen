import streamlit as st
from mido import Message, MidiFile, MidiTrack
import tempfile

st.set_page_config(page_title="🎼 Piano Music Generator", layout="centered")
st.title("🎹 Piano Music Generator (MIDI Only)")

# UI inputs
style = st.selectbox("Style", ["Classical", "Jazz", "Pop", "Ambient"])
key = st.selectbox("Key", ["C major", "D major", "G major", "A minor"])
tempo = st.slider("Tempo (BPM)", 40, 180, 100)
mood = st.radio("Mood", ["Happy", "Melancholic", "Dreamy", "Intense"])
duration = st.selectbox("Duration", ["30 sec", "1 min", "2 min"], index=1)

if st.button("🎼 Generate MIDI"):
    with st.spinner("Generating MIDI..."):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mid") as tmp:
            mid = MidiFile()
            track = MidiTrack()
            mid.tracks.append(track)
            # Simple scale example
            for note in [60, 62, 64, 65, 67, 69, 71, 72]:
                track.append(Message('note_on', note=note, velocity=64, time=0))
                track.append(Message('note_off', note=note, velocity=64, time=480))
            mid.save(tmp.name)
            st.success("✅ MIDI Generated")
            st.audio(tmp.name)
            with open(tmp.name, "rb") as f:
                st.download_button("⬇️ Download MIDI", f, file_name="piano_scale.mid")
