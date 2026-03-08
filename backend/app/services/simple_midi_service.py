"""
Enhanced procedural MIDI generation service with music theory.
Generates musically coherent piano pieces with melody, harmony, and dynamics.
"""
import os
import random
import datetime
from typing import Tuple, Optional, List

try:
    import mido
    MIDO_AVAILABLE = True
except ImportError:
    MIDO_AVAILABLE = False

from ..utils.key_transposer import (
    get_scale, get_progression_chords, get_root_note, is_minor
)
from ..config import settings


# Melodic patterns: intervals relative to current position in scale
MELODIC_PATTERNS = {
    "Classical": {
        "motifs": [
            [0, 1, 2, 1],           # Step up, step back
            [0, 2, 4, 2],           # Arpeggio up and back
            [0, -1, -2, 0],         # Step down, return
            [0, 2, 1, 3, 2],        # Ascending with neighbor tones
            [0, 4, 3, 2, 1, 0],     # Descending scale run
            [0, 2, 4, 7, 4, 2],     # Arpeggio up high, descend
        ],
        "rhythm_patterns": [
            [1.0, 1.0, 1.0, 1.0],
            [0.5, 0.5, 1.0, 0.5, 0.5],
            [1.5, 0.5, 1.0, 1.0],
            [0.75, 0.25, 0.5, 0.5, 1.0],
            [2.0, 1.0, 0.5, 0.5],
        ],
    },
    "Jazz": {
        "motifs": [
            [0, 2, 4, 6, 4],        # Extended arpeggio
            [0, 3, 5, 3, 1],        # Jazzy leap
            [0, -2, 1, 3, 5],       # Chromatic approach
            [0, 4, 3, 7, 5],        # Wide intervals
            [0, 1, 4, 3, 6, 5],     # Bebop-style enclosure
        ],
        "rhythm_patterns": [
            [0.75, 0.25, 1.0, 1.0, 1.0],   # Swing feel
            [0.5, 1.0, 0.5, 1.0, 1.0],
            [1.5, 0.5, 0.75, 0.25, 1.0],
            [0.25, 0.75, 0.5, 0.5, 1.0, 1.0],
            [1.0, 0.5, 0.5, 0.5, 0.5, 1.0],
        ],
    },
    "Pop": {
        "motifs": [
            [0, 0, 2, 2, 4, 4, 2],   # Repetitive pop melody
            [0, 2, 4, 2, 0, -1, 0],   # Singable contour
            [0, 4, 4, 2, 2, 0],       # Descending in pairs
            [0, 0, 3, 2, 0],          # Hook-like
            [0, 2, 0, 4, 2, 0],       # Pop hook pattern
        ],
        "rhythm_patterns": [
            [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.0],
            [1.0, 1.0, 0.5, 0.5, 1.0],
            [0.5, 0.5, 1.0, 1.0, 1.0],
            [1.0, 0.5, 0.5, 0.5, 0.5],
            [0.5, 1.0, 0.5, 1.0, 1.0],
        ],
    },
    "Ambient": {
        "motifs": [
            [0, 4, 7, 4],            # Slow arpeggio
            [0, 2, 0, -2, 0],        # Gentle oscillation
            [0, 7, 4, 2],            # Wide open intervals
            [0, 5, 3, 7],            # Spacious
            [0, 2, 4, 7, 9, 7, 4],   # Rising and falling
        ],
        "rhythm_patterns": [
            [2.0, 2.0, 2.0, 2.0],
            [3.0, 1.0, 2.0, 2.0],
            [2.0, 2.0, 4.0],
            [1.5, 1.5, 1.0, 2.0, 2.0],
            [4.0, 2.0, 2.0],
        ],
    },
}

# Mood affects velocity, note density, and interval preferences
MOOD_SETTINGS = {
    "Happy": {
        "velocity_base": 85,
        "velocity_variation": 20,
        "prefer_ascending": True,
        "note_density": 1.0,
        "octave_preference": 1,    # Higher octave
        "chord_velocity": 65,
        "swing": 0.0,
    },
    "Melancholic": {
        "velocity_base": 60,
        "velocity_variation": 15,
        "prefer_ascending": False,
        "note_density": 0.8,
        "octave_preference": 0,
        "chord_velocity": 50,
        "swing": 0.0,
    },
    "Dreamy": {
        "velocity_base": 55,
        "velocity_variation": 10,
        "prefer_ascending": True,
        "note_density": 0.6,
        "octave_preference": 1,
        "chord_velocity": 45,
        "swing": 0.0,
    },
    "Intense": {
        "velocity_base": 100,
        "velocity_variation": 25,
        "prefer_ascending": True,
        "note_density": 1.3,
        "octave_preference": 0,
        "chord_velocity": 80,
        "swing": 0.0,
    },
}


class SimpleMidiService:
    """Service for generating musically coherent procedural MIDI files."""

    def __init__(self, output_dir: str = None):
        self.output_dir = output_dir or settings.GENERATED_MIDI_PATH

    async def generate(
        self,
        tempo: int = 100,
        duration_sec: int = 30,
        mood: str = "Happy",
        key: str = "C major",
        style: str = "Classical"
    ) -> Tuple[Optional[str], Optional[str]]:
        """Generate a musically coherent MIDI piece."""
        if not MIDO_AVAILABLE:
            return None, "mido library not available"

        try:
            mid = mido.MidiFile(ticks_per_beat=480)
            ticks_per_beat = 480

            # Create melody track
            melody_track = mido.MidiTrack()
            mid.tracks.append(melody_track)

            # Create accompaniment track
            accomp_track = mido.MidiTrack()
            mid.tracks.append(accomp_track)

            # Set tempo on melody track
            tempo_us = mido.bpm2tempo(tempo)
            melody_track.append(mido.MetaMessage('set_tempo', tempo=tempo_us, time=0))
            melody_track.append(mido.MetaMessage('track_name', name='Piano Right Hand', time=0))

            accomp_track.append(mido.MetaMessage('track_name', name='Piano Left Hand', time=0))

            # Both tracks use piano (program 0)
            melody_track.append(mido.Message('program_change', program=0, channel=0, time=0))
            accomp_track.append(mido.Message('program_change', program=0, channel=1, time=0))

            # Get musical data
            scale = get_scale(key)
            mood_cfg = MOOD_SETTINGS.get(mood, MOOD_SETTINGS["Happy"])
            style_patterns = MELODIC_PATTERNS.get(style, MELODIC_PATTERNS["Classical"])
            chords = get_progression_chords(key, style)

            # Calculate total beats
            total_beats = (duration_sec * tempo) / 60.0
            beats_per_chord = max(2.0, total_beats / (len(chords) * max(1, int(total_beats / (len(chords) * 4)))))

            # Generate melody
            self._generate_melody(
                melody_track, scale, style_patterns, mood_cfg,
                total_beats, ticks_per_beat, tempo
            )

            # Generate accompaniment (chords)
            self._generate_accompaniment(
                accomp_track, chords, mood_cfg, style,
                total_beats, ticks_per_beat, tempo
            )

            # Add end-of-track
            melody_track.append(mido.MetaMessage('end_of_track', time=0))
            accomp_track.append(mido.MetaMessage('end_of_track', time=0))

            # Save file
            os.makedirs(self.output_dir, exist_ok=True)
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"piano_{mood.lower()}_{style.lower()}_{key.replace(' ', '_')}_{timestamp}.mid"
            filepath = os.path.join(self.output_dir, filename)

            mid.save(filepath)
            return filepath, None

        except Exception as e:
            return None, f"MIDI generation failed: {e}"

    def _generate_melody(
        self,
        track: 'mido.MidiTrack',
        scale: List[int],
        style_patterns: dict,
        mood_cfg: dict,
        total_beats: float,
        ticks_per_beat: int,
        tempo: int
    ):
        """Generate a melodic line using motifs and patterns."""
        motifs = style_patterns["motifs"]
        rhythm_patterns = style_patterns["rhythm_patterns"]

        current_beat = 0.0
        current_scale_idx = len(scale) // 2  # Start in middle of scale
        velocity_base = mood_cfg["velocity_base"]
        velocity_var = mood_cfg["velocity_variation"]
        density = mood_cfg["note_density"]

        # Track phrase structure (4 or 8 bar phrases)
        beats_per_phrase = 16.0  # 4 bars of 4/4
        phrase_num = 0

        while current_beat < total_beats:
            # Pick a motif and rhythm
            motif = random.choice(motifs)
            rhythm = random.choice(rhythm_patterns)

            # Adjust rhythm for density
            rhythm = [r / density for r in rhythm]

            # Ensure motif and rhythm align
            pattern_len = min(len(motif), len(rhythm))

            # Add occasional rests between phrases
            phrase_position = current_beat % beats_per_phrase
            if phrase_position < 0.01 and phrase_num > 0 and random.random() < 0.3:
                rest_beats = random.choice([0.5, 1.0, 1.5])
                current_beat += rest_beats

            for i in range(pattern_len):
                if current_beat >= total_beats:
                    break

                # Calculate scale index with the motif interval
                target_idx = current_scale_idx + motif[i]
                target_idx = max(0, min(len(scale) - 1, target_idx))
                note = scale[target_idx]

                # Apply octave preference
                note += mood_cfg["octave_preference"] * 12
                note = max(36, min(96, note))

                # Calculate velocity with musical dynamics
                phrase_pos_fraction = (current_beat % beats_per_phrase) / beats_per_phrase
                # Crescendo in first half, decrescendo in second
                dynamic_curve = 1.0 - abs(phrase_pos_fraction - 0.5) * 0.4
                # Beat emphasis (stronger on beats 1 and 3)
                beat_in_bar = current_beat % 4.0
                beat_accent = 1.1 if beat_in_bar < 0.1 or abs(beat_in_bar - 2.0) < 0.1 else 1.0

                velocity = int(velocity_base * dynamic_curve * beat_accent +
                             random.randint(-velocity_var // 2, velocity_var // 2))
                velocity = max(30, min(127, velocity))

                # Note duration
                dur_beats = rhythm[i]
                # Legato: note sounds for 90% of its rhythmic duration
                note_dur_ticks = int(dur_beats * ticks_per_beat * 0.9)
                gap_ticks = int(dur_beats * ticks_per_beat * 0.1)

                # Add note
                track.append(mido.Message('note_on', note=note, velocity=velocity, channel=0, time=0))
                track.append(mido.Message('note_off', note=note, velocity=0, channel=0, time=note_dur_ticks))

                # Small gap between notes
                if gap_ticks > 0 and i < pattern_len - 1:
                    # The gap time is added to the next note_on's time
                    # We handle this by making the next note_on start after gap_ticks
                    pass  # gap handled by next note_on time

                current_beat += dur_beats
                current_scale_idx = target_idx  # Track position for next motif

            # After motif, maybe step to neighboring area
            if random.random() < 0.3:
                step = random.choice([-2, -1, 1, 2])
                if mood_cfg["prefer_ascending"]:
                    step = abs(step)
                current_scale_idx += step
                current_scale_idx = max(2, min(len(scale) - 3, current_scale_idx))

            phrase_num += 1

        # End on tonic
        tonic = scale[0] + mood_cfg["octave_preference"] * 12
        tonic = max(36, min(96, tonic))
        track.append(mido.Message('note_on', note=tonic, velocity=velocity_base, channel=0, time=0))
        track.append(mido.Message('note_off', note=tonic, velocity=0, channel=0, time=ticks_per_beat * 4))

    def _generate_accompaniment(
        self,
        track: 'mido.MidiTrack',
        chords: List[List[int]],
        mood_cfg: dict,
        style: str,
        total_beats: float,
        ticks_per_beat: int,
        tempo: int
    ):
        """Generate chord accompaniment for the left hand."""
        chord_velocity = mood_cfg["chord_velocity"]
        current_beat = 0.0

        # Calculate how many beats each chord gets
        chord_cycle_beats = len(chords) * 4.0  # Each chord gets 4 beats by default

        while current_beat < total_beats:
            chord_idx = int((current_beat % chord_cycle_beats) / 4.0) % len(chords)
            chord_notes = chords[chord_idx]

            if style == "Ambient":
                # Whole note chords - sustained pads
                self._play_chord_sustained(track, chord_notes, chord_velocity, ticks_per_beat, 4.0)
                current_beat += 4.0

            elif style == "Jazz":
                # Comping rhythm - syncopated chord hits
                comp_patterns = [
                    [1.5, 1.0, 1.5],
                    [1.0, 1.0, 0.5, 0.5, 1.0],
                    [0.5, 1.5, 1.0, 1.0],
                    [2.0, 1.0, 1.0],
                ]
                pattern = random.choice(comp_patterns)
                for dur in pattern:
                    if current_beat >= total_beats:
                        break
                    vel = chord_velocity + random.randint(-10, 10)
                    vel = max(25, min(110, vel))
                    self._play_chord_sustained(track, chord_notes, vel, ticks_per_beat, dur * 0.8)
                    # Gap
                    gap = int(dur * 0.2 * ticks_per_beat)
                    if gap > 0:
                        track.append(mido.Message('note_on', note=0, velocity=0, channel=1, time=gap))
                    current_beat += dur

            elif style == "Pop":
                # Broken chord / arpeggio pattern
                arp_patterns = [
                    [0, 1, 2, 1],    # Root-3rd-5th-3rd
                    [0, 2, 1, 2],    # Root-5th-3rd-5th
                    [0, 1, 2, 0],    # Simple arpeggio
                ]
                arp = random.choice(arp_patterns)
                beat_dur = 1.0
                for idx in arp:
                    if current_beat >= total_beats:
                        break
                    note_idx = idx % len(chord_notes)
                    note = chord_notes[note_idx]
                    vel = chord_velocity + random.randint(-5, 5)
                    vel = max(25, min(110, vel))
                    dur_ticks = int(beat_dur * ticks_per_beat * 0.85)
                    gap_ticks = int(beat_dur * ticks_per_beat * 0.15)
                    track.append(mido.Message('note_on', note=note, velocity=vel, channel=1, time=0))
                    track.append(mido.Message('note_off', note=note, velocity=0, channel=1, time=dur_ticks))
                    if gap_ticks > 0:
                        # Silence gap handled by next event delta
                        pass
                    current_beat += beat_dur

            else:  # Classical
                # Alberti bass pattern or block chords alternating
                if random.random() < 0.5:
                    # Alberti bass: root-5th-3rd-5th
                    alberti = [0, 2, 1, 2] if len(chord_notes) >= 3 else [0, 1, 0, 1]
                    beat_dur = 1.0
                    for idx in alberti:
                        if current_beat >= total_beats:
                            break
                        note_idx = idx % len(chord_notes)
                        note = chord_notes[note_idx]
                        vel = chord_velocity + random.randint(-8, 8)
                        vel = max(25, min(110, vel))
                        dur_ticks = int(beat_dur * ticks_per_beat * 0.9)
                        track.append(mido.Message('note_on', note=note, velocity=vel, channel=1, time=0))
                        track.append(mido.Message('note_off', note=note, velocity=0, channel=1, time=dur_ticks))
                        current_beat += beat_dur
                else:
                    # Block chord on beat 1, single bass on beat 3
                    vel = chord_velocity + random.randint(-5, 5)
                    vel = max(25, min(110, vel))
                    self._play_chord_sustained(track, chord_notes, vel, ticks_per_beat, 2.0)
                    current_beat += 2.0
                    if current_beat < total_beats and chord_notes:
                        bass = chord_notes[0]
                        track.append(mido.Message('note_on', note=bass, velocity=vel - 10, channel=1, time=0))
                        track.append(mido.Message('note_off', note=bass, velocity=0, channel=1, time=ticks_per_beat * 2))
                        current_beat += 2.0

    def _play_chord_sustained(
        self,
        track: 'mido.MidiTrack',
        chord_notes: List[int],
        velocity: int,
        ticks_per_beat: int,
        duration_beats: float
    ):
        """Play all notes of a chord simultaneously and sustain."""
        duration_ticks = int(duration_beats * ticks_per_beat)
        velocity = max(25, min(127, velocity))

        # Note on for all chord notes (first has time=0, rest have time=0 too for simultaneous)
        for i, note in enumerate(chord_notes):
            track.append(mido.Message('note_on', note=note, velocity=velocity, channel=1, time=0))

        # Note off for all (first off has the full duration, rest have time=0)
        for i, note in enumerate(chord_notes):
            track.append(mido.Message('note_off', note=note, velocity=0, channel=1,
                                      time=duration_ticks if i == 0 else 0))
