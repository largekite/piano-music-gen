import Foundation

/// Pure Swift MIDI file generator.
/// Ported from backend/app/services/simple_midi_service.py with improvements:
/// - Adds a proper tempo meta-event (the Python version omitted this, forcing 120 BPM)
/// - Uses MIDI format 0 (simpler than the Python mido default of format 1)
/// - Appends a short UUID suffix to filenames to prevent collisions
struct MIDIGenerator {

    // MARK: - Constants

    private static let ticksPerBeat: UInt16 = 480

    // Note velocity (ported from Python: velocity=80)
    private static let noteOnVelocity: UInt8 = 80
    private static let noteOffVelocity: UInt8 = 0

    // Duration choices in ticks: 0.5, 1.0, 1.5, 2.0 beats × 480 ticks/beat
    // Ported from Python: random.choice([0.5, 1, 1.5, 2])
    private static let durationChoicesTicks: [Int] = [240, 480, 720, 960]

    // MARK: - Public API

    /// Generate MIDI data from music parameters.
    /// - Returns: Raw MIDI binary Data ready to write to a .mid file
    static func generate(
        tempo: Int,
        durationSec: Int,
        key: MusicKey,
        style: MusicStyle
    ) -> Data {
        // Exact port: total_notes = max(4, int(duration_sec * tempo / 60))
        let totalNotes = max(4, durationSec * tempo / 60)
        let trackData = buildTrackData(
            tempo: tempo,
            totalNotes: totalNotes,
            scale: key.scale,
            program: style.generalMIDIProgram
        )
        return buildMIDIFile(trackData: trackData)
    }

    // MARK: - Track Data Builder

    private static func buildTrackData(
        tempo: Int,
        totalNotes: Int,
        scale: [UInt8],
        program: UInt8
    ) -> Data {
        var track = Data()

        // 1. Tempo meta-event: FF 51 03 tt tt tt
        //    microseconds per beat = 60,000,000 / BPM
        let usPerBeat = 60_000_000 / max(tempo, 1)
        track += vlq(0)  // delta time = 0
        track += Data([
            0xFF, 0x51, 0x03,
            UInt8((usPerBeat >> 16) & 0xFF),
            UInt8((usPerBeat >> 8)  & 0xFF),
            UInt8(usPerBeat         & 0xFF)
        ])

        // 2. Program change: C0 <program>
        track += vlq(0)  // delta time = 0
        track += Data([0xC0, program])

        // 3. Note events
        for _ in 0..<totalNotes {
            guard let note = scale.randomElement(),
                  let durationTicks = durationChoicesTicks.randomElement()
            else { continue }

            // Note ON: delta=0, 90 <note> <velocity>
            track += vlq(0)
            track += Data([0x90, note, noteOnVelocity])

            // Note OFF: delta=durationTicks, 80 <note> 00
            track += vlq(durationTicks)
            track += Data([0x80, note, noteOffVelocity])
        }

        // 4. End of track meta-event: FF 2F 00
        track += vlq(0)
        track += Data([0xFF, 0x2F, 0x00])

        return track
    }

    // MARK: - MIDI File Structure

    private static func buildMIDIFile(trackData: Data) -> Data {
        var midi = Data()

        // MThd header chunk (14 bytes total)
        midi += Data("MThd".utf8)
        midi += uint32BE(6)                               // header length = 6
        midi += uint16BE(0)                               // format 0 (single track)
        midi += uint16BE(1)                               // 1 track
        midi += uint16BE(UInt32(ticksPerBeat))            // ticks per beat = 480

        // MTrk track chunk
        midi += Data("MTrk".utf8)
        midi += uint32BE(UInt32(trackData.count))
        midi += trackData

        return midi
    }

    // MARK: - VLQ (Variable Length Quantity) Encoding

    /// Encode an integer as a MIDI variable-length quantity.
    /// Each byte contributes 7 bits; bit 7 set means more bytes follow.
    /// The result is big-endian (most significant 7-bit group first).
    static func vlq(_ value: Int) -> Data {
        guard value > 0 else { return Data([0x00]) }
        var result: [UInt8] = []
        var v = value
        // Collect 7-bit groups least-significant first
        result.append(UInt8(v & 0x7F))  // last group: no continuation bit
        v >>= 7
        while v > 0 {
            result.append(UInt8((v & 0x7F) | 0x80))  // set continuation bit
            v >>= 7
        }
        return Data(result.reversed())  // flip to big-endian order
    }

    // MARK: - Big-Endian Byte Helpers

    private static func uint16BE(_ value: UInt32) -> Data {
        Data([UInt8((value >> 8) & 0xFF), UInt8(value & 0xFF)])
    }

    private static func uint32BE(_ value: UInt32) -> Data {
        Data([
            UInt8((value >> 24) & 0xFF),
            UInt8((value >> 16) & 0xFF),
            UInt8((value >> 8)  & 0xFF),
            UInt8(value         & 0xFF)
        ])
    }
}

// MARK: - Data concatenation convenience
private func += (lhs: inout Data, rhs: Data) {
    lhs.append(rhs)
}
