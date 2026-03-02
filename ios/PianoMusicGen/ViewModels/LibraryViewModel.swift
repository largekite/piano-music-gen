import Foundation
import Observation

@Observable
@MainActor
final class LibraryViewModel {

    // MARK: - State

    var tracks: [TrackRecord] = []
    var deletionError: String? = nil

    // MARK: - Dependencies

    private let storage: TrackStorageService
    let player: MIDIPlayer

    // MARK: - Init

    init(storage: TrackStorageService, player: MIDIPlayer) {
        self.storage = storage
        self.player = player
    }

    // MARK: - Load

    func loadTracks() {
        tracks = storage.loadAll()
    }

    // MARK: - Playback

    func togglePlayback(for record: TrackRecord) {
        let url = storage.fileURL(for: record)
        player.toggle(fileURL: url, trackID: record.id)
    }

    func isPlaying(_ record: TrackRecord) -> Bool {
        player.currentTrackID == record.id && player.isPlaying
    }

    // MARK: - Delete

    func delete(record: TrackRecord) {
        if player.currentTrackID == record.id {
            player.stop()
        }
        do {
            try storage.delete(record: record)
            tracks.removeAll { $0.id == record.id }
        } catch {
            deletionError = error.localizedDescription
        }
    }

    /// Called from SwiftUI's .onDelete modifier
    func delete(at offsets: IndexSet) {
        let toDelete = offsets.map { tracks[$0] }
        toDelete.forEach { delete(record: $0) }
    }
}
