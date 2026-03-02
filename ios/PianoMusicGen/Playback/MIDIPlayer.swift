import AVFoundation
import Observation

/// Wraps AVMIDIPlayer with @Observable state for SwiftUI integration.
///
/// Usage notes:
/// - AVMIDIPlayer must be initialized on the main thread.
/// - The play(completionHandler:) callback arrives on a background queue;
///   always dispatch back to MainActor before mutating @Observable state.
/// - Requires AVAudioSession to be configured before first play (done in init).
@Observable
@MainActor
final class MIDIPlayer {

    // MARK: - Observable State

    var isPlaying: Bool = false
    var currentTrackID: UUID? = nil
    var playbackProgress: Double = 0.0  // 0.0 to 1.0

    // MARK: - Private

    private var player: AVMIDIPlayer?
    private var progressTimer: Timer?
    private var totalDuration: Double = 0.0

    // MARK: - Init

    init() {
        configureAudioSession()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )
    }

    // MARK: - Play

    /// Start playback of a MIDI file.
    /// - Parameters:
    ///   - fileURL: URL to the .mid file
    ///   - trackID: UUID of the track (used to identify which track is playing)
    func play(fileURL: URL, trackID: UUID) {
        stop()
        guard let soundFontURL else { return }

        do {
            player = try AVMIDIPlayer(contentsOf: fileURL, soundBankURL: soundFontURL)
            player?.prepareToPlay()
            totalDuration = player?.duration ?? 0.0
            currentTrackID = trackID
            isPlaying = true

            player?.play { [weak self] in
                // Completion handler fires on a background queue
                Task { @MainActor [weak self] in
                    self?.isPlaying = false
                    self?.playbackProgress = 0.0
                    self?.currentTrackID = nil
                    self?.progressTimer?.invalidate()
                    self?.progressTimer = nil
                }
            }
            startProgressTimer()
        } catch {
            // Common on simulator without host audio configured
            isPlaying = false
        }
    }

    // MARK: - Stop

    func stop() {
        progressTimer?.invalidate()
        progressTimer = nil
        player?.stop()
        player = nil
        isPlaying = false
        playbackProgress = 0.0
        currentTrackID = nil
    }

    // MARK: - Toggle

    func toggle(fileURL: URL, trackID: UUID) {
        if currentTrackID == trackID && isPlaying {
            stop()
        } else {
            play(fileURL: fileURL, trackID: trackID)
        }
    }

    // MARK: - Progress Timer

    private func startProgressTimer() {
        progressTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self, let player = self.player, self.totalDuration > 0 else { return }
            Task { @MainActor [weak self] in
                self?.playbackProgress = player.currentPosition / (self?.totalDuration ?? 1.0)
            }
        }
    }

    // MARK: - Audio Session

    private func configureAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playback,
                mode: .default,
                options: [.mixWithOthers]
            )
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            // Non-fatal: audio session may already be configured by the system
        }
    }

    // MARK: - Interruption Handling (phone calls, Siri, AirPods pull)

    @objc private func handleInterruption(_ notification: Notification) {
        guard
            let info = notification.userInfo,
            let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: typeValue)
        else { return }

        if type == .began {
            Task { @MainActor [weak self] in
                self?.stop()
            }
        }
    }

    // MARK: - SoundFont

    /// Resolves the best available sound bank:
    /// 1. Bundled SF2 (preferred, needed for real device)
    /// 2. macOS system DLS (available in Simulator; not present on real iOS device)
    private var soundFontURL: URL? {
        // 1. Bundled SF2
        if let url = Bundle.main.url(forResource: "GeneralUser GS v1.471", withExtension: "sf2") {
            return url
        }
        if let url = Bundle.main.url(forResource: "piano", withExtension: "sf2") {
            return url
        }
        // 2. macOS system DLS — accessible from the iOS Simulator (runs on Mac)
        let systemDLS = URL(fileURLWithPath:
            "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls")
        if FileManager.default.fileExists(atPath: systemDLS.path) {
            return systemDLS
        }
        return nil
    }
}
