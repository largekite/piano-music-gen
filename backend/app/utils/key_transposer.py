"""
Musical key transposition utilities.
Defines key scales and transposition offsets for MIDI note manipulation.
"""
from typing import List, Dict


# MIDI note numbers for each musical key scale
KEY_SCALES: Dict[str, List[int]] = {
    "C major": [60, 62, 64, 65, 67, 69, 71, 72],      # C D E F G A B C
    "D major": [62, 64, 66, 67, 69, 71, 73, 74],      # D E F# G A B C# D
    "G major": [67, 69, 71, 72, 74, 76, 78, 79],      # G A B C D E F# G
    "A minor": [69, 71, 72, 74, 76, 77, 79, 81],      # A B C D E F G A
}

# Semitone offsets from C for transposition
KEY_OFFSETS: Dict[str, int] = {
    "C major": 0,
    "D major": 2,
    "G major": 7,
    "A minor": 9,  # Relative to C
}


def get_scale(key: str) -> List[int]:
    """
    Get the MIDI note numbers for a given musical key.

    Args:
        key: Musical key (e.g., "C major", "D major", "G major", "A minor")

    Returns:
        List of MIDI note numbers in the scale
    """
    return KEY_SCALES.get(key, KEY_SCALES["C major"])


def get_offset(key: str) -> int:
    """
    Get the semitone offset for a given key.

    Args:
        key: Musical key (e.g., "C major", "D major", "G major", "A minor")

    Returns:
        Semitone offset from C
    """
    return KEY_OFFSETS.get(key, 0)


def transpose_notes(notes: List[int], target_key: str) -> List[int]:
    """
    Transpose a list of MIDI note numbers to a target key.

    Args:
        notes: List of MIDI note numbers
        target_key: Target musical key

    Returns:
        List of transposed MIDI note numbers
    """
    offset = get_offset(target_key)
    return [note + offset for note in notes]


def transpose_note(note: int, target_key: str) -> int:
    """
    Transpose a single MIDI note number to a target key.

    Args:
        note: MIDI note number
        target_key: Target musical key

    Returns:
        Transposed MIDI note number
    """
    offset = get_offset(target_key)
    return note + offset
