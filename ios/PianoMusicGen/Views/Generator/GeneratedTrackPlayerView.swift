import SwiftUI

/// Compact playback card shown in GeneratorView after a track is created.
struct GeneratedTrackPlayerView: View {
    let title: String
    @Bindable var player: MIDIPlayer
    let trackID: UUID?
    let onToggle: () -> Void

    private var isThisTrackPlaying: Bool {
        guard let id = trackID else { return false }
        return player.currentTrackID == id && player.isPlaying
    }

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 14) {
                // Play / Stop button
                Button(action: onToggle) {
                    ZStack {
                        Circle()
                            .fill(Color.accentColor)
                            .frame(width: 48, height: 48)
                        Image(systemName: isThisTrackPlaying ? "stop.fill" : "play.fill")
                            .font(.system(size: 18))
                            .foregroundStyle(.white)
                            // Offset play icon slightly to visually center it
                            .offset(x: isThisTrackPlaying ? 0 : 2)
                    }
                }
                .buttonStyle(.plain)
                .animation(.easeInOut(duration: 0.15), value: isThisTrackPlaying)

                VStack(alignment: .leading, spacing: 4) {
                    Text(title.isEmpty ? "Generated Track" : title)
                        .font(.headline)
                        .lineLimit(1)
                    Text(isThisTrackPlaying ? "Playing" : "Tap to play")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Image(systemName: "pianokeys")
                    .font(.title3)
                    .foregroundStyle(Color.accentColor.opacity(0.6))
            }

            // Progress bar (only visible while playing)
            if isThisTrackPlaying {
                ProgressView(value: player.playbackProgress)
                    .progressViewStyle(.linear)
                    .tint(Color.accentColor)
                    .transition(.opacity)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.accentColor.opacity(0.15), radius: 6, y: 3)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.accentColor.opacity(0.2), lineWidth: 1)
        )
        .animation(.easeInOut(duration: 0.2), value: isThisTrackPlaying)
    }
}
