import SwiftUI

struct RootView: View {
    let storage: TrackStorageService
    let player: MIDIPlayer

    var body: some View {
        TabView {
            GeneratorView(
                viewModel: GeneratorViewModel(storage: storage, player: player)
            )
            .tabItem {
                Label("Generate", systemImage: "waveform.badge.plus")
            }

            LibraryView(
                viewModel: LibraryViewModel(storage: storage, player: player)
            )
            .tabItem {
                Label("Library", systemImage: "music.note.list")
            }
        }
    }
}
