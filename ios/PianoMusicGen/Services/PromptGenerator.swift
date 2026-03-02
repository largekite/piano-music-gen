import Foundation

/// Generates human-readable music descriptions from generation parameters.
/// Ported from backend/app/utils/prompt_generator.py
enum PromptGenerator {

    static func generate(parameters: MusicParameters) -> String {
        let tempoWord = tempoDescription(for: parameters.tempo)
        let styleAdj = styleAdjectives[parameters.style]!.randomElement()!
        let moodAdj = moodDescriptors[parameters.mood]!.randomElement()!
        let style = parameters.style.rawValue
        let key = parameters.key.rawValue
        let tempo = parameters.tempo
        let mood = parameters.mood.rawValue
        let duration = parameters.duration.rawValue

        let templates: [String] = [
            "A \(moodAdj) \(style.lowercased()) piano piece in \(key), \(tempoWord) tempo (\(tempo) BPM), lasting \(duration)",
            "\(styleAdj.capitalized) \(style.lowercased()) piano music with a \(mood.lowercased()) mood, \(tempoWord) paced in \(key)",
            "\(tempoWord.capitalized) \(mood.lowercased()) piano composition in \(key), \(style.lowercased()) style, \(duration) duration",
            "Piano solo: \(moodAdj) and \(styleAdj), \(key) signature, \(tempo) BPM \(style.lowercased()) piece"
        ]
        return templates.randomElement()!
    }

    // MARK: - Private Lookup Tables
    // Ported exactly from prompt_generator.py

    private static func tempoDescription(for bpm: Int) -> String {
        switch bpm {
        case 40..<70:   return "very slow"
        case 70..<90:   return "slow"
        case 90..<120:  return "moderate"
        case 120..<140: return "fast"
        default:        return "very fast"
        }
    }

    private static let styleAdjectives: [MusicStyle: [String]] = [
        .classical: ["elegant", "sophisticated", "graceful", "refined"],
        .jazz:      ["smooth", "syncopated", "improvisational", "swinging"],
        .pop:       ["catchy", "melodic", "contemporary", "accessible"],
        .ambient:   ["atmospheric", "ethereal", "floating", "meditative"]
    ]

    private static let moodDescriptors: [Mood: [String]] = [
        .happy:       ["joyful", "uplifting", "bright", "cheerful", "energetic"],
        .melancholic: ["wistful", "nostalgic", "contemplative", "bittersweet", "reflective"],
        .dreamy:      ["flowing", "gentle", "soft", "peaceful", "serene"],
        .intense:     ["dramatic", "powerful", "passionate", "dynamic", "bold"]
    ]
}
