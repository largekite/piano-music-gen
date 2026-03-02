import Foundation

enum GenerationState: Equatable {
    case idle
    case generating
    case success(URL)    // file URL of the generated MIDI
    case failed(String)  // localized error message
}
