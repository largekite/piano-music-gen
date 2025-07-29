import streamlit as st
import tempfile
import requests
import os
from gradio_client import Client

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

if st.button("Generate MIDI"):
    with st.spinner("Contacting Hugging Face Space..."):
        try:
            client = Client("largekite/music")  # ⚠️ This is the Space ID
            result = client.predict(prompt, api_name="/predict")  # assumes default API
            st.success("✅ MIDI ready!")
            st.markdown(f"[⬇️ Download MIDI file]({result})")
        except Exception as e:
            st.error(f"❌ Failed: {e}")

