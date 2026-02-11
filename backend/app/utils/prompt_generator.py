"""
AI-powered music description generator based on parameters.
Ported from original app_streamlit.py (lines 20-61)
"""
import random
from typing import Dict, List


def generate_ai_prompt(
    style: str,
    key: str,
    tempo: int,
    mood: str,
    duration: str
) -> str:
    """
    Generate AI-powered music description based on parameters.

    Args:
        style: Musical style (Classical, Jazz, Pop, Ambient)
        key: Musical key (C major, D major, G major, A minor)
        tempo: Tempo in BPM (40-180)
        mood: Mood (Happy, Melancholic, Dreamy, Intense)
        duration: Duration (30 sec, 1 min, 2 min)

    Returns:
        str: Generated prompt describing the desired music
    """
    # Map tempo ranges to descriptive words
    tempo_desc: Dict[range, str] = {
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

    # Style-specific adjectives
    style_variations: Dict[str, List[str]] = {
        "Classical": ["elegant", "sophisticated", "graceful", "refined"],
        "Jazz": ["smooth", "syncopated", "improvisational", "swinging"],
        "Pop": ["catchy", "melodic", "contemporary", "accessible"],
        "Ambient": ["atmospheric", "ethereal", "floating", "meditative"]
    }

    # Mood-specific descriptors
    mood_descriptors: Dict[str, List[str]] = {
        "Happy": ["joyful", "uplifting", "bright", "cheerful", "energetic"],
        "Melancholic": ["wistful", "nostalgic", "contemplative", "bittersweet", "reflective"],
        "Dreamy": ["flowing", "gentle", "soft", "peaceful", "serene"],
        "Intense": ["dramatic", "powerful", "passionate", "dynamic", "bold"]
    }

    # Random selection for variety
    style_adj = random.choice(style_variations.get(style, ["beautiful"]))
    mood_adj = random.choice(mood_descriptors.get(mood, ["expressive"]))

    # Multiple prompt templates for variety
    prompts = [
        f"A {mood_adj} {style.lower()} piano piece in {key}, {tempo_word} tempo ({tempo} BPM), lasting {duration}",
        f"{style_adj.title()} {style.lower()} piano music with a {mood.lower()} mood, {tempo_word} paced in {key}",
        f"{tempo_word.title()} {mood.lower()} piano composition in {key}, {style.lower()} style, {duration} duration",
        f"Piano solo: {mood_adj} and {style_adj}, {key} signature, {tempo} BPM {style.lower()} piece"
    ]

    return random.choice(prompts)
