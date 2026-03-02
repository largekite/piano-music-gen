import Foundation

// MARK: - MusicStyle
// Ported from backend/app/models.py MusicStyle enum
// Program numbers from backend/app/services/simple_midi_service.py style_programs dict
enum MusicStyle: String, CaseIterable, Codable {
    case classical = "Classical"
    case jazz      = "Jazz"
    case pop       = "Pop"
    case ambient   = "Ambient"

    /// General MIDI program number for each style
    var generalMIDIProgram: UInt8 {
        switch self {
        case .classical: return 0   // Acoustic Grand Piano
        case .jazz:      return 4   // Electric Piano 1
        case .pop:       return 6   // Harpsichord
        case .ambient:   return 88  // Pad 1 (new age)
        }
    }

    var icon: String {
        switch self {
        case .classical: return "music.quarternote.3"
        case .jazz:      return "music.note.list"
        case .pop:       return "star.fill"
        case .ambient:   return "cloud.fill"
        }
    }
}

// MARK: - MusicKey
// All 12 major and 12 minor keys.
// Scales are computed from rootMIDINote + mode offsets (no giant switch needed).
enum MusicKey: String, CaseIterable, Codable {
    // Major keys
    case cMajor      = "C major"
    case cSharpMajor = "C# major"
    case dMajor      = "D major"
    case dSharpMajor = "D# major"
    case eMajor      = "E major"
    case fMajor      = "F major"
    case fSharpMajor = "F# major"
    case gMajor      = "G major"
    case gSharpMajor = "G# major"
    case aMajor      = "A major"
    case aSharpMajor = "A# major"
    case bMajor      = "B major"
    // Minor keys
    case cMinor      = "C minor"
    case cSharpMinor = "C# minor"
    case dMinor      = "D minor"
    case dSharpMinor = "D# minor"
    case eMinor      = "E minor"
    case fMinor      = "F minor"
    case fSharpMinor = "F# minor"
    case gMinor      = "G minor"
    case gSharpMinor = "G# minor"
    case aMinor      = "A minor"
    case aSharpMinor = "A# minor"
    case bMinor      = "B minor"

    // MARK: - Scale

    /// MIDI note numbers for the 8-note scale (root to octave).
    /// Major: W W H W W W H  → offsets [0,2,4,5,7,9,11,12]
    /// Minor: W H W W H W W  → offsets [0,2,3,5,7,8,10,12]
    var scale: [UInt8] {
        let offsets: [Int] = isMajor
            ? [0, 2, 4, 5, 7, 9, 11, 12]
            : [0, 2, 3, 5, 7, 8, 10, 12]
        return offsets.map { UInt8(rootMIDINote + $0) }
    }

    var isMajor: Bool { rawValue.hasSuffix("major") }

    /// MIDI root note in octave 4 (C4 = 60).
    var rootMIDINote: Int {
        switch self {
        case .cMajor,      .cMinor:      return 60
        case .cSharpMajor, .cSharpMinor: return 61
        case .dMajor,      .dMinor:      return 62
        case .dSharpMajor, .dSharpMinor: return 63
        case .eMajor,      .eMinor:      return 64
        case .fMajor,      .fMinor:      return 65
        case .fSharpMajor, .fSharpMinor: return 66
        case .gMajor,      .gMinor:      return 67
        case .gSharpMajor, .gSharpMinor: return 68
        case .aMajor,      .aMinor:      return 69
        case .aSharpMajor, .aSharpMinor: return 70
        case .bMajor,      .bMinor:      return 71
        }
    }

    /// Just the chromatic note name, e.g. "C#" (no major/minor suffix).
    var noteName: String { String(rawValue.split(separator: " ").first ?? "") }

    /// Short display name: "C", "F#", "Am", "A#m" etc.
    var shortName: String { isMajor ? noteName : "\(noteName)m" }

    // MARK: - Convenience

    static let majorKeys: [MusicKey] = allCases.filter { $0.isMajor }
    static let minorKeys: [MusicKey] = allCases.filter { !$0.isMajor }

    /// Returns the same note in the opposite mode (C major ↔ C minor).
    var toggledMode: MusicKey {
        let candidates = isMajor ? MusicKey.minorKeys : MusicKey.majorKeys
        return candidates.first(where: { $0.noteName == noteName }) ?? self
    }
}

// MARK: - Mood
// Ported from backend/app/models.py Mood enum
enum Mood: String, CaseIterable, Codable {
    case happy       = "Happy"
    case melancholic = "Melancholic"
    case dreamy      = "Dreamy"
    case intense     = "Intense"

    var emoji: String {
        switch self {
        case .happy:       return "😊"
        case .melancholic: return "🌧️"
        case .dreamy:      return "✨"
        case .intense:     return "🔥"
        }
    }
}

// MARK: - Duration
// Ported from backend/app/models.py Duration enum
enum Duration: String, CaseIterable, Codable {
    case thirtySeconds = "30 sec"
    case oneMinute     = "1 min"
    case twoMinutes    = "2 min"

    var seconds: Int {
        switch self {
        case .thirtySeconds: return 30
        case .oneMinute:     return 60
        case .twoMinutes:    return 120
        }
    }
}

// MARK: - MusicParameters
struct MusicParameters: Codable, Equatable {
    var style: MusicStyle    = .classical
    var key: MusicKey        = .cMajor
    var mood: Mood           = .happy
    var duration: Duration   = .oneMinute
    var tempo: Int           = 100  // 40...180 BPM

    static let tempoRange: ClosedRange<Double> = 40...180

    /// UserDefaults key for persisting last-used parameters
    static let defaultsKey = "lastMusicParameters"
}
