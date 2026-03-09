"""
Musical key transposition and music theory utilities.
Defines key scales, chord progressions, and transposition for MIDI note manipulation.
"""
import random
from typing import List, Dict, Tuple


# Base MIDI note numbers for each musical key scale (spanning 2 octaves for melody)
KEY_SCALES: Dict[str, List[int]] = {
    "C major":  [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76],
    "D major":  [50, 52, 54, 55, 57, 59, 61, 62, 64, 66, 67, 69, 71, 73, 74, 76, 78],
    "E major":  [52, 54, 56, 57, 59, 61, 63, 64, 66, 68, 69, 71, 73, 75, 76, 78, 80],
    "F major":  [53, 55, 57, 58, 60, 62, 64, 65, 67, 69, 70, 72, 74, 76, 77, 79, 81],
    "G major":  [55, 57, 59, 60, 62, 64, 66, 67, 69, 71, 72, 74, 76, 78, 79, 81, 83],
    "A major":  [57, 59, 61, 62, 64, 66, 68, 69, 71, 73, 74, 76, 78, 80, 81, 83, 85],
    "Bb major": [58, 60, 62, 63, 65, 67, 69, 70, 72, 74, 75, 77, 79, 81, 82, 84, 86],
    "A minor":  [57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81],
    "C minor":  [48, 50, 51, 53, 55, 56, 58, 60, 62, 63, 65, 67, 68, 70, 72],
    "D minor":  [50, 52, 53, 55, 57, 58, 60, 62, 64, 65, 67, 69, 70, 72, 74],
    "E minor":  [52, 54, 55, 57, 59, 60, 62, 64, 66, 67, 69, 71, 72, 74, 76],
    "G minor":  [55, 57, 58, 60, 62, 63, 65, 67, 69, 70, 72, 74, 75, 77, 79],
}

# Semitone offsets from C for transposition
KEY_OFFSETS: Dict[str, int] = {
    "C major": 0, "D major": 2, "E major": 4, "F major": 5,
    "G major": 7, "A major": 9, "Bb major": 10,
    "A minor": 9, "C minor": 0, "D minor": 2, "E minor": 4, "G minor": 7,
}

# Chord definitions as intervals from root (semitones)
CHORD_INTERVALS: Dict[str, List[int]] = {
    "major":     [0, 4, 7],
    "minor":     [0, 3, 7],
    "dim":       [0, 3, 6],
    "major7":    [0, 4, 7, 11],
    "minor7":    [0, 3, 7, 10],
    "dom7":      [0, 4, 7, 10],
    "sus2":      [0, 2, 7],
    "sus4":      [0, 5, 7],
}

# Common chord progressions for each style (scale degrees 1-7, with chord quality)
CHORD_PROGRESSIONS: Dict[str, List[List[Tuple[int, str]]]] = {
    "Classical": [
        [(1, "major"), (5, "major"), (6, "minor"), (4, "major")],
        [(1, "major"), (4, "major"), (5, "major"), (1, "major")],
        [(1, "major"), (6, "minor"), (4, "major"), (5, "major")],
        [(1, "major"), (4, "major"), (1, "major"), (5, "major")],
    ],
    "Jazz": [
        [(2, "minor7"), (5, "dom7"), (1, "major7"), (1, "major7")],
        [(1, "major7"), (6, "minor7"), (2, "minor7"), (5, "dom7")],
        [(1, "major7"), (4, "major7"), (3, "minor7"), (6, "minor7")],
        [(2, "minor7"), (5, "dom7"), (1, "major7"), (4, "major7")],
    ],
    "Pop": [
        [(1, "major"), (5, "major"), (6, "minor"), (4, "major")],
        [(6, "minor"), (4, "major"), (1, "major"), (5, "major")],
        [(1, "major"), (4, "major"), (6, "minor"), (5, "major")],
        [(1, "major"), (3, "minor"), (4, "major"), (5, "major")],
    ],
    "Ambient": [
        [(1, "major7"), (4, "major7"), (1, "major7"), (4, "major7")],
        [(1, "sus2"), (4, "sus2"), (5, "sus4"), (1, "sus2")],
        [(1, "major7"), (6, "minor7"), (4, "major7"), (5, "sus4")],
        [(1, "major"), (3, "minor"), (6, "minor"), (4, "major")],
    ],
}

# Scale degree to semitone offset
MAJOR_SCALE_DEGREES: List[int] = [0, 2, 4, 5, 7, 9, 11]
MINOR_SCALE_DEGREES: List[int] = [0, 2, 3, 5, 7, 8, 10]


def get_root_note(key: str) -> int:
    """Get the root MIDI note (octave 3) for a key."""
    key_roots = {
        "C": 48, "D": 50, "E": 52, "F": 53, "G": 55, "A": 57, "Bb": 58, "B": 59,
    }
    root_name = key.split()[0]
    return key_roots.get(root_name, 48)


def is_minor(key: str) -> bool:
    return "minor" in key.lower()


def get_scale(key: str) -> List[int]:
    return KEY_SCALES.get(key, KEY_SCALES["C major"])


def get_offset(key: str) -> int:
    return KEY_OFFSETS.get(key, 0)


def get_chord_notes(root: int, chord_type: str, octave_offset: int = 0) -> List[int]:
    """Build a chord from root note and chord type."""
    intervals = CHORD_INTERVALS.get(chord_type, CHORD_INTERVALS["major"])
    return [max(0, min(127, root + interval + (octave_offset * 12))) for interval in intervals]


def get_scale_degree_note(key: str, degree: int) -> int:
    """Get the MIDI note for a scale degree in a key."""
    root = get_root_note(key)
    degrees = MINOR_SCALE_DEGREES if is_minor(key) else MAJOR_SCALE_DEGREES
    idx = (degree - 1) % 7
    octave = (degree - 1) // 7
    return root + degrees[idx] + (octave * 12)


def get_progression_chords(key: str, style: str) -> List[List[int]]:
    """Get chord voicings for a progression in the given key and style."""
    progressions = CHORD_PROGRESSIONS.get(style, CHORD_PROGRESSIONS["Classical"])
    progression = random.choice(progressions)

    chords = []
    for degree, chord_type in progression:
        root = get_scale_degree_note(key, degree)
        chord_root = root - 12 if root >= 60 else root
        chord_notes = get_chord_notes(chord_root, chord_type)
        chords.append(chord_notes)

    return chords


def transpose_notes(notes: List[int], target_key: str) -> List[int]:
    offset = get_offset(target_key)
    return [max(0, min(127, note + offset)) for note in notes]


def transpose_note(note: int, target_key: str) -> int:
    offset = get_offset(target_key)
    return max(0, min(127, note + offset))
