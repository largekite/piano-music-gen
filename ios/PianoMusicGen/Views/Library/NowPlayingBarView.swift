import SwiftUI

struct NowPlayingBarView: View {
    @Bindable var player: MIDIPlayer
    let trackTitle: String

    var body: some View {
        VStack(spacing: 0) {
            Divider()
            VStack(spacing: 6) {
                ProgressView(value: player.playbackProgress)
                    .progressViewStyle(.linear)
                    .tint(Color.accentColor)
                    .padding(.horizontal)

                HStack {
                    Image(systemName: "pianokeys")
                        .foregroundStyle(Color.accentColor)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(trackTitle)
                            .font(.subheadline.bold())
                            .lineLimit(1)
                        Text("Now Playing")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button {
                        player.stop()
                    } label: {
                        Image(systemName: "stop.circle.fill")
                            .font(.title2)
                            .foregroundStyle(Color.accentColor)
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 8)
            }
            .padding(.top, 8)
            .background(.ultraThinMaterial)
        }
    }
}
