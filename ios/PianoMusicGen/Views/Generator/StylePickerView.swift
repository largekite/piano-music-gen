import SwiftUI

struct StylePickerView: View {
    @Binding var style: MusicStyle
    @Binding var key: MusicKey

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Style", systemImage: "music.quarternote.3")
                .font(.headline)
                .foregroundStyle(.primary)

            // Style grid
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
                ForEach(MusicStyle.allCases, id: \.self) { s in
                    Button {
                        style = s
                    } label: {
                        VStack(spacing: 4) {
                            Image(systemName: s.icon)
                                .font(.title3)
                            Text(s.rawValue)
                                .font(.caption2)
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(style == s ? Color.accentColor : Color(.secondarySystemBackground))
                        .foregroundStyle(style == s ? .white : .primary)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                    .animation(.easeInOut(duration: 0.15), value: style)
                }
            }

            // Key picker
            HStack {
                Label("Key", systemImage: "pianokeys")
                    .font(.headline)
                    .foregroundStyle(.primary)
                Spacer()
                // Major / Minor toggle
                Picker("Mode", selection: modBinding) {
                    Text("Major").tag(true)
                    Text("Minor").tag(false)
                }
                .pickerStyle(.segmented)
                .frame(width: 140)
            }
            .padding(.top, 4)

            // 12-note grid (2 rows × 6 columns)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 6), spacing: 6) {
                ForEach(activeKeys, id: \.self) { k in
                    Button {
                        key = k
                    } label: {
                        Text(k.noteName)
                            .font(.system(size: 13, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 9)
                            .background(key == k ? Color.accentColor : Color(.secondarySystemBackground))
                            .foregroundStyle(key == k ? .white : .primary)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                    .animation(.easeInOut(duration: 0.12), value: key)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.06), radius: 4, y: 2)
    }

    // MARK: - Helpers

    /// Keys for the currently selected mode (major or minor).
    private var activeKeys: [MusicKey] {
        key.isMajor ? MusicKey.majorKeys : MusicKey.minorKeys
    }

    /// Binding that toggles between major and minor while keeping the same note.
    private var modBinding: Binding<Bool> {
        Binding(
            get: { key.isMajor },
            set: { isMajor in
                if isMajor != key.isMajor { key = key.toggledMode }
            }
        )
    }
}
