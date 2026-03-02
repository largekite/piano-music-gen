import SwiftUI

@main
struct PianoMusicGenApp: App {
    // Shared singletons created once at app launch
    private let storage = TrackStorageService()
    private let player = MIDIPlayer()

    var body: some Scene {
        WindowGroup {
            RootView(storage: storage, player: player)
        }
    }
}
