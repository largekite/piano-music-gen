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
    with st.spinner("Contacting backend..."):
        url = "https://your-username-your-space.hf.space/generate-midi"  # 🔁 CHANGE THIS
        try:
            response = requests.post(url, json={"prompt": prompt})
            if response.status_code == 200:
                st.success("✅ MIDI received!")
                st.download_button("⬇️ Download MIDI", response.content, file_name="generated.mid")
            else:
                st.error(f"Error: {response.status_code}")
        except Exception as e:
            st.error(f"Connection failed: {e}")
