import Foundation
import Observation

@Observable
@MainActor
final class GeneratorViewModel {

    // MARK: - State

    var parameters = MusicParameters()
    var generationState: GenerationState = .idle
    var generatedDescription: String = ""
    var lastGeneratedTrackID: UUID? = nil
    var lastGeneratedTitle: String = ""

    // MARK: - Dependencies

    private let storage: TrackStorageService
    let player: MIDIPlayer

    // MARK: - Init

    init(storage: TrackStorageService, player: MIDIPlayer) {
        self.storage = storage
        self.player = player
        loadSavedParameters()
    }

    // MARK: - Generation

    func generate() {
        // Allow generate from idle or success state; block while already generating
        if case .generating = generationState { return }
        generationState = .generating
        generatedDescription = PromptGenerator.generate(parameters: parameters)
        saveParameters()

        // Capture value type before leaving MainActor context
        let params = parameters
        let storage = self.storage
        let player = self.player

        Task.detached(priority: .userInitiated) {
            do {
                let data = MIDIGenerator.generate(
                    tempo: params.tempo,
                    durationSec: params.duration.seconds,
                    key: params.key,
                    style: params.style
                )
                let (record, url) = try storage.save(data: data, parameters: params)
                await MainActor.run {
                    self.generationState = .success(url)
                    self.lastGeneratedTrackID = record.id
                    self.lastGeneratedTitle = record.displayTitle
                    player.play(fileURL: url, trackID: record.id)
                }
            } catch {
                await MainActor.run {
                    self.generationState = .failed(error.localizedDescription)
                }
            }
        }
    }

    func toggleLastTrack() {
        guard case .success(let url) = generationState,
              let trackID = lastGeneratedTrackID else { return }
        player.toggle(fileURL: url, trackID: trackID)
    }

    func resetState() {
        generationState = .idle
        generatedDescription = ""
    }

    // MARK: - Persistence

    private func loadSavedParameters() {
        guard let data = UserDefaults.standard.data(forKey: MusicParameters.defaultsKey),
              let params = try? JSONDecoder().decode(MusicParameters.self, from: data)
        else { return }
        parameters = params
    }

    private func saveParameters() {
        if let data = try? JSONEncoder().encode(parameters) {
            UserDefaults.standard.set(data, forKey: MusicParameters.defaultsKey)
        }
    }
}
