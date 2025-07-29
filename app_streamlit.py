import streamlit as st
from mido import Message, MidiFile, MidiTrack
import tempfile
import requests
import os

st.set_page_config(page_title="🎼 Piano Music Generator", layout="centered")
st.title("🎹 Piano Music Generator (MIDI Only)")

# UI inputs
style = st.selectbox("Style", ["Classical", "Jazz", "Pop", "Ambient"])
key = st.selectbox("Key", ["C major", "D major", "G major", "A minor"])
tempo = st.slider("Tempo (BPM)", 40, 180, 100)
mood = st.radio("Mood", ["Happy", "Melancholic", "Dreamy", "Intense"])
duration = st.selectbox("Duration", ["30 sec", "1 min", "2 min"], index=1)

# Input from the user
prompt = st.text_input("🧠 Describe the music", value="A calm melody in C major")

if st.button("🎼 Generate MIDI"):
    with st.spinner("Sending request to Hugging Face Gradio backend..."):
        try:
            url = "https://huggingface.co/spaces/largekite/music" 
            response = requests.post(url, json={
                "data": [prompt]
            })
            if response.ok:
                output_url = response.json()["data"][0]["url"]
                st.success("✅ MIDI ready!")
                st.markdown(f"[⬇️ Download MIDI]({output_url})")
            else:
                st.error("❌ API call failed. Check Space status or URL.")
        except Exception as e:
            st.error(f"Error: {e}")

