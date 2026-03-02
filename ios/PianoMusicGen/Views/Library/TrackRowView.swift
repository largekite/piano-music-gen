import SwiftUI

struct TrackRowView: View {
    let record: TrackRecord
    let isPlaying: Bool
    let progress: Double
    let onTap: () -> Void
    let onShare: () -> Void

    var body: some View {
        HStack(spacing: 14) {
            // Play / Stop button
            Button(action: onTap) {
                ZStack {
                    Circle()
                        .fill(isPlaying ? Color.accentColor : Color(.secondarySystemBackground))
                        .frame(width: 44, height: 44)
                    Image(systemName: isPlaying ? "stop.fill" : "play.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(isPlaying ? Color.white : Color.accentColor)
                }
            }
            .buttonStyle(.plain)

            // Track info
            VStack(alignment: .leading, spacing: 3) {
                Text(record.displayTitle)
                    .font(.headline)
                    .lineLimit(1)
                Text(record.displaySubtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                // Progress bar when playing
                if isPlaying {
                    ProgressView(value: progress)
                        .progressViewStyle(.linear)
                        .tint(Color.accentColor)
                        .frame(maxWidth: 200)
                        .transition(.opacity)
                }

                Text(record.formattedDate)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            Spacer()

            // Share button
            Button(action: onShare) {
                Image(systemName: "square.and.arrow.up")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 4)
        .animation(.easeInOut(duration: 0.2), value: isPlaying)
    }
}
